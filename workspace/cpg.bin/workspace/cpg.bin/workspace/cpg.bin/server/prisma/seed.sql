-- Seed users (passwords hashed with bcrypt, agent123 and admin123)
INSERT INTO "user" (email, phone_number, "password_hash", "name", "role")
VALUES
  ('agent1@gmail.com', '123-456-7891', '$2a$12$iTAykiIcy2J.pDxlrffJ1ODdHFi.vDARoL5BI2qpgStbqYylLJyEq', 'Agent Smith 1', 'user'),
  ('agent2@gmail.com', '124-456-7890', '$2b$10$eUnSYctw2bA5lcDxvHyqOu4Bemi6NIQv0wTUJcIsr53t7fKi0SlOy', 'Agent Smith 2', 'user'),
  ('admin1@gmail.com', '120-342-4235', '$2a$12$bAQZI.kF9xu2mh7aNQJ6Z.96wdjWbr1cNxUalOVnSd5/Ds4cfSzkm', 'Admin User 1', 'admin')
ON CONFLICT (email) DO NOTHING;