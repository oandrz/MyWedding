-- Backfill: reverse HTML entity encoding introduced by previous sanitizer behavior.
-- Prior to this fix, bluemonday HTML-encoded `&`, `<`, `>` into `&amp;`, `&lt;`, `&gt;`
-- even though the frontend renders these fields as plain text.

UPDATE invites
SET name = replace(replace(replace(name, '&amp;', '&'), '&lt;', '<'), '&gt;', '>');

UPDATE rsvp
SET name = replace(replace(replace(name, '&amp;', '&'), '&lt;', '<'), '&gt;', '>');

UPDATE messages
SET name = replace(replace(replace(name, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
    content = replace(replace(replace(content, '&amp;', '&'), '&lt;', '<'), '&gt;', '>');

UPDATE media
SET caption = replace(replace(replace(caption, '&amp;', '&'), '&lt;', '<'), '&gt;', '>')
WHERE caption IS NOT NULL;

UPDATE welcome_screen
SET heading_text      = replace(replace(replace(heading_text,      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
    heading_text_id   = replace(replace(replace(heading_text_id,   '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
    delivery_label    = replace(replace(replace(delivery_label,    '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
    delivery_label_id = replace(replace(replace(delivery_label_id, '&amp;', '&'), '&lt;', '<'), '&gt;', '>'),
    fallback_name     = replace(replace(replace(fallback_name,     '&amp;', '&'), '&lt;', '<'), '&gt;', '>');
