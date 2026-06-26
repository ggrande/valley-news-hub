WITH targets AS (
  SELECT id, reddit_import_id FROM public.posts
  WHERE title ILIKE 'Rejected Source Material%'
    AND coalesce(length(body), 0) = 0
)
, del_attempts AS (
  DELETE FROM public.reddit_comment_attempts a
    USING public.reddit_comment_notifications n
   WHERE a.notification_id = n.id AND n.post_id IN (SELECT id FROM targets)
  RETURNING 1
)
, del_notifs AS (
  DELETE FROM public.reddit_comment_notifications WHERE post_id IN (SELECT id FROM targets) RETURNING 1
)
, del_tags AS (
  DELETE FROM public.post_tags WHERE post_id IN (SELECT id FROM targets) RETURNING 1
)
, del_versions AS (
  DELETE FROM public.post_versions WHERE post_id IN (SELECT id FROM targets) RETURNING 1
)
, del_comments AS (
  DELETE FROM public.comments WHERE post_id IN (SELECT id FROM targets) RETURNING 1
)
, null_logs AS (
  UPDATE public.ai_generation_logs SET post_id = NULL WHERE post_id IN (SELECT id FROM targets) RETURNING 1
)
, reset_imports AS (
  UPDATE public.reddit_imports
     SET import_status = 'discarded',
         generated_post_id = NULL,
         processing_error = 'Auto-rejected: empty/rejected source material'
   WHERE id IN (SELECT reddit_import_id FROM targets WHERE reddit_import_id IS NOT NULL)
  RETURNING 1
)
DELETE FROM public.posts WHERE id IN (SELECT id FROM targets);