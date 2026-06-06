-- Migration: Preferences matching triggers and queue trigger logic
-- ==============================================================================

-- 1. Helper function to queue notification processing
CREATE OR REPLACE FUNCTION public.invoke_telegram_queue_processor()
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := (SELECT CONCAT(decrypted_secret, '/functions/v1/process-telegram-queue')
            FROM vault.decrypted_secrets
            WHERE name = 'supabase_url'),
    headers := jsonb_build_object(
        'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
        'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function for newly inserted jobs
CREATE OR REPLACE FUNCTION public.process_job_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  pref RECORD;
  msg TEXT;
  job_url TEXT;
  vacancies_str TEXT;
  last_date_str TEXT;
  val TEXT;
  job_level NUMERIC;
  title_esc TEXT;
  dept_esc TEXT;
  qual_esc TEXT;
  loc_esc TEXT;
  vac_esc TEXT;
  date_esc TEXT;
BEGIN
  vacancies_str := COALESCE(NEW.vacancies_display, NEW.vacancies::TEXT, 'Not Published');
  last_date_str := COALESCE(NEW.last_date_display, NEW.last_date::TEXT, 'Check Website');
  job_url := CONCAT('https://www.jobstrackr.in/job/', COALESCE(NEW.slug, NEW.id::TEXT));

  -- Unify lowercase search text (title + department)
  val := LOWER(COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.department, ''));

  -- Map job required qualification to a numeric level:
  -- 5: Postgraduate/PhD, 4: Graduate, 3.5: Diploma, 3: 12th/ITI, 2: 10th, 1: 8th
  job_level := CASE 
    WHEN LOWER(NEW.qualification) LIKE '%post%graduat%' OR LOWER(NEW.qualification) LIKE '%master%' OR LOWER(NEW.qualification) LIKE '%mtech%' OR LOWER(NEW.qualification) LIKE '%msc%' OR LOWER(NEW.qualification) LIKE '%ma%' OR LOWER(NEW.qualification) LIKE '%mcom%' OR LOWER(NEW.qualification) LIKE '%phd%' OR LOWER(NEW.qualification) LIKE '%doctorate%' THEN 5.0
    WHEN LOWER(NEW.qualification) LIKE '%graduat%' OR LOWER(NEW.qualification) LIKE '%degree%' OR LOWER(NEW.qualification) LIKE '%btech%' OR LOWER(NEW.qualification) LIKE '%b.e%' OR LOWER(NEW.qualification) LIKE '%bsc%' OR LOWER(NEW.qualification) LIKE '%ba%' OR LOWER(NEW.qualification) LIKE '%bcom%' OR LOWER(NEW.qualification) LIKE '%mbbs%' OR LOWER(NEW.qualification) LIKE '%llb%' OR LOWER(NEW.qualification) LIKE '%b.ed%' OR LOWER(NEW.qualification) LIKE '%b.pharm%' THEN 4.0
    WHEN LOWER(NEW.qualification) LIKE '%diploma%' THEN 3.5
    WHEN LOWER(NEW.qualification) LIKE '%12th%' OR LOWER(NEW.qualification) LIKE '%twelfth%' OR LOWER(NEW.qualification) LIKE '%hsc%' OR LOWER(NEW.qualification) LIKE '%intermediate%' OR LOWER(NEW.qualification) LIKE '%iti%' THEN 3.0
    WHEN LOWER(NEW.qualification) LIKE '%10th%' OR LOWER(NEW.qualification) LIKE '%tenth%' OR LOWER(NEW.qualification) LIKE '%ssc%' OR LOWER(NEW.qualification) LIKE '%matric%' THEN 2.0
    WHEN LOWER(NEW.qualification) LIKE '%8th%' OR LOWER(NEW.qualification) LIKE '%eighth%' OR LOWER(NEW.qualification) LIKE '%middle%' THEN 1.0
    ELSE 0.0
  END;

  -- Escape HTML special characters for the dynamic variables
  title_esc := replace(replace(replace(NEW.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  dept_esc  := replace(replace(replace(NEW.department, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  qual_esc  := replace(replace(replace(COALESCE(NEW.qualification, 'Refer Notification'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  loc_esc   := replace(replace(replace(NEW.location, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  vac_esc   := replace(replace(replace(vacancies_str, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  date_esc  := replace(replace(replace(last_date_str, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  -- Loop through active telegram connections and check preference matches
  FOR pref IN 
    SELECT conn.telegram_chat_id, pref.* 
    FROM public.telegram_connections conn
    JOIN public.notification_preferences pref ON conn.user_id = pref.user_id
    WHERE conn.is_active = TRUE AND pref.job_notifications = TRUE
  LOOP
    -- 1. Category matching
    IF (
      (pref.ssc AND (val LIKE '%ssc%' OR val LIKE '%staff selection%')) OR
      (pref.upsc AND (val LIKE '%upsc%' OR val LIKE '%union public%')) OR
      (pref.railway AND (val LIKE '%railway%' OR val LIKE '%rrb%')) OR
      (pref.banking AND (val LIKE '%bank%' OR val LIKE '%ibps%' OR val LIKE '%sbi%')) OR
      (pref.defence AND (val LIKE '%defence%' OR val LIKE '%army%' OR val LIKE '%navy%' OR val LIKE '%police%' OR val LIKE '%constable%' OR val LIKE '%military%' OR val LIKE '%bsf%' OR val LIKE '%crpf%' OR val LIKE '%cisf%')) OR
      (pref.psu AND (val LIKE '%psu%' OR val LIKE '%ongc%' OR val LIKE '%ntpc%' OR val LIKE '%sail%' OR val LIKE '%bhel%' OR val LIKE '%iocl%' OR val LIKE '%gail%')) OR
      (pref.state_psc AND (val LIKE '%psc%' OR val LIKE '%public service commission%')) OR
      (pref.healthcare AND (val LIKE '%healthcare%' OR val LIKE '%medical%' OR val LIKE '%nurse%' OR val LIKE '%doctor%' OR val LIKE '%health%'))
    ) THEN
      -- 2. Location/State matching (Allow All India, empty state pref, literal match, or checking that location has no other state)
      IF (
        'All India' = ANY(pref.preferred_states) OR
        cardinality(pref.preferred_states) = 0 OR
        LOWER(NEW.location) LIKE '%all india%' OR 
        LOWER(NEW.location) LIKE '%across india%' OR 
        LOWER(NEW.location) LIKE '%pan india%' OR 
        LOWER(NEW.location) = 'india' OR 
        LOWER(NEW.location) LIKE '%various%' OR 
        LOWER(NEW.location) LIKE '%nationwide%' OR
        EXISTS (
          SELECT 1 
          FROM unnest(pref.preferred_states) AS s
          WHERE POSITION(LOWER(s) IN LOWER(NEW.location)) > 0 OR POSITION(LOWER(NEW.location) IN LOWER(s)) > 0
        ) OR
        NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar', 'Chandigarh', 'Dadra and Nagar', 'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry']) AS other_state
          WHERE (POSITION(LOWER(other_state) IN LOWER(NEW.location)) > 0 OR POSITION(LOWER(NEW.location) IN LOWER(other_state)) > 0)
            AND NOT (other_state = ANY(pref.preferred_states))
        )
      ) THEN
        -- 3. Qualification matching (Hierarchical check based on user checked boxes)
        IF (
          NEW.qualification IS NULL OR
          job_level = 0.0 OR
          (job_level = 5.0 AND pref.postgraduate) OR
          (job_level = 4.0 AND pref.graduate) OR
          (job_level = 3.5 AND (pref.graduate OR pref.twelfth_pass)) OR
          (job_level = 3.0 AND pref.twelfth_pass) OR
          (job_level = 2.0 AND pref.tenth_pass) OR
          (job_level = 1.0 AND pref.tenth_pass)
        ) THEN
          -- Build HTML message
          msg := CONCAT(
            '🚨 <b>NEW JOB ALERT</b>', E'\n\n',
            '📋 <b>Title</b>: ', title_esc, E'\n',
            '🏢 <b>Organization</b>: ', dept_esc, E'\n',
            '🎓 <b>Qualification</b>: ', qual_esc, E'\n',
            '📍 <b>Location</b>: ', loc_esc, E'\n',
            '👥 <b>Vacancies</b>: ', vac_esc, E'\n',
            '📅 <b>Last Date</b>: ', date_esc, E'\n\n',
            '🔗 <b><a href="', job_url, '">View Details on Website</a></b>'
          );
          
          -- Queue notification
          INSERT INTO public.telegram_notifications_queue (user_id, telegram_chat_id, job_id, message_text)
          VALUES (pref.user_id, pref.telegram_chat_id, NEW.id, msg);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Fire the background queue processor asynchronously
  PERFORM public.invoke_telegram_queue_processor();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_job_inserted_queue ON public.jobs;
CREATE TRIGGER on_job_inserted_queue
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.process_job_notification_trigger();

-- 3. Trigger function for newly inserted exam updates (Admit card, Results, Answer keys)
CREATE OR REPLACE FUNCTION public.process_exam_update_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  pref RECORD;
  msg TEXT;
  update_url TEXT;
  alert_title TEXT;
  category_match BOOLEAN;
  val TEXT;
  title_esc TEXT;
  sum_esc TEXT;
BEGIN
  -- Select matching title prefix based on category
  IF NEW.category = 'admit_card' THEN
    alert_title := '🎫 <b>NEW ADMIT CARD ALERT</b>';
  ELSIF NEW.category = 'result' THEN
    alert_title := '🏆 <b>NEW RESULT ALERT</b>';
  ELSIF NEW.category = 'answer_key' THEN
    alert_title := '🔑 <b>NEW ANSWER KEY ALERT</b>';
  ELSE
    RETURN NEW; -- Skip other categories for general telegram alerts
  END IF;

  update_url := CONCAT('https://www.jobstrackr.in/exam-update/', NEW.id);

  -- Unify search text (title + summary)
  val := LOWER(COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.summary, ''));

  -- Escape HTML special characters
  title_esc := replace(replace(replace(NEW.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  sum_esc   := replace(replace(replace(COALESCE(NEW.summary, 'New update published.'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  -- Loop through active telegram connections and check matches
  FOR pref IN 
    SELECT conn.telegram_chat_id, pref.* 
    FROM public.telegram_connections conn
    JOIN public.notification_preferences pref ON conn.user_id = pref.user_id
    WHERE conn.is_active = TRUE
  LOOP
    -- Category alert enabled check
    IF (NEW.category = 'admit_card' AND pref.admit_card_notifications = TRUE) OR
       (NEW.category = 'result' AND pref.result_notifications = TRUE) OR
       (NEW.category = 'answer_key' AND pref.answer_key_notifications = TRUE) THEN
       
      -- Category text match (SSC, UPSC, etc.)
      category_match := (
        (pref.ssc AND (val LIKE '%ssc%' OR val LIKE '%staff selection%')) OR
        (pref.upsc AND (val LIKE '%upsc%' OR val LIKE '%union public%')) OR
        (pref.railway AND (val LIKE '%railway%' OR val LIKE '%rrb%')) OR
        (pref.banking AND (val LIKE '%bank%' OR val LIKE '%ibps%' OR val LIKE '%sbi%')) OR
        (pref.defence AND (val LIKE '%defence%' OR val LIKE '%army%' OR val LIKE '%navy%' OR val LIKE '%police%' OR val LIKE '%constable%' OR val LIKE '%military%' OR val LIKE '%bsf%' OR val LIKE '%crpf%' OR val LIKE '%cisf%')) OR
        (pref.psu AND (val LIKE '%psu%' OR val LIKE '%ongc%' OR val LIKE '%ntpc%' OR val LIKE '%sail%' OR val LIKE '%bhel%' OR val LIKE '%iocl%' OR val LIKE '%gail%')) OR
        (pref.state_psc AND (val LIKE '%psc%' OR val LIKE '%public service commission%')) OR
        (pref.healthcare AND (val LIKE '%healthcare%' OR val LIKE '%medical%' OR val LIKE '%nurse%' OR val LIKE '%doctor%' OR val LIKE '%health%'))
      );
      
      -- Send notification if category matches or user follows All India updates
      IF category_match OR 'All India' = ANY(pref.preferred_states) OR cardinality(pref.preferred_states) = 0 THEN
        
        -- State location match in title
        IF 'All India' = ANY(pref.preferred_states) OR cardinality(pref.preferred_states) = 0 OR EXISTS (
          SELECT 1 
          FROM unnest(pref.preferred_states) AS s
          WHERE POSITION(LOWER(s) IN LOWER(NEW.title)) > 0
        ) OR NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar', 'Chandigarh', 'Dadra and Nagar', 'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry']) AS other_state
          WHERE POSITION(LOWER(other_state) IN LOWER(NEW.title)) > 0
            AND NOT (other_state = ANY(pref.preferred_states))
        ) THEN
          -- Build message
          msg := CONCAT(
            alert_title, E'\n\n',
            '📋 <b>Title</b>: ', title_esc, E'\n',
            '📝 <b>Summary</b>: ', sum_esc, E'\n\n',
            '🔗 <b><a href="', update_url, '">View Details on Website</a></b>'
          );
          
          -- Queue notification
          INSERT INTO public.telegram_notifications_queue (user_id, telegram_chat_id, update_id, message_text)
          VALUES (pref.user_id, pref.telegram_chat_id, NEW.id, msg);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Fire the background queue processor asynchronously
  PERFORM public.invoke_telegram_queue_processor();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_exam_update_inserted_queue ON public.exam_updates;
CREATE TRIGGER on_exam_update_inserted_queue
  AFTER INSERT ON public.exam_updates
  FOR EACH ROW EXECUTE FUNCTION public.process_exam_update_notification_trigger();
