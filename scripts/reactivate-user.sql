SELECT id, username, email, role, active
FROM users
WHERE active = 0;

UPDATE users
SET active = 1
WHERE id = ?;
