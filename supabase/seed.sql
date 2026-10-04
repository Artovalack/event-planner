-- SQL commands to seed the database with mock data for testing

-- Create users
INSERT INTO users (id, email, password, created_at) VALUES
(1, 'user1@example.com', 'password1', NOW()),
(2, 'user2@example.com', 'password2', NOW());

-- Create events
INSERT INTO events (id, title, description, date, created_by, created_at) VALUES
(1, 'Event One', 'Description for Event One', '2023-12-01', 1, NOW()),
(2, 'Event Two', 'Description for Event Two', '2023-12-15', 1, NOW()),
(3, 'Event Three', 'Description for Event Three', '2023-12-20', 2, NOW());

-- Create attendees
INSERT INTO attendees (id, event_id, user_id, created_at) VALUES
(1, 1, 1, NOW()),
(2, 1, 2, NOW()),
(3, 2, 1, NOW()),
(4, 3, 2, NOW());