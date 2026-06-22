DELETE FROM public.post_tags WHERE post_id IN (SELECT id FROM public.posts WHERE source_type = 'original');
DELETE FROM public.post_versions WHERE post_id IN (SELECT id FROM public.posts WHERE source_type = 'original');
DELETE FROM public.comments WHERE post_id IN (SELECT id FROM public.posts WHERE source_type = 'original');
DELETE FROM public.posts WHERE source_type = 'original';