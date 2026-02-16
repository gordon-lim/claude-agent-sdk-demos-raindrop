-- Add support for multi-content messages (text + images)
-- The content column will now store JSON for messages with images
-- For backward compatibility, text-only messages can remain as plain text

-- We don't need to alter the column type since SQLite TEXT can store JSON
-- Just add a new column to track if content is JSON
ALTER TABLE messages ADD COLUMN content_type TEXT DEFAULT 'text';

-- Update existing messages to have content_type='text'
UPDATE messages SET content_type = 'text' WHERE content_type IS NULL;
