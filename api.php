<?php
declare(strict_types=1);

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Strict',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function input_data(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        respond(['error' => 'Invalid request data.'], 400);
    }
    return $data;
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['error' => 'Use POST for this request.'], 405);
    }
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        respond(['error' => 'Your session expired. Refresh the page and try again.'], 403);
    }
}

function require_college(): void
{
    if (empty($_SESSION['college_user_id'])) {
        respond(['error' => 'Please log in to the College Portal.'], 401);
    }
}

function require_student(): void
{
    if (empty($_SESSION['student_record_id'])) {
        respond(['error' => 'Please log in with your Student ID and password.'], 401);
    }
}

function required_text(array $data, string $key, int $maxLength): string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '' || strlen($value) > $maxLength) {
        respond(['error' => 'Please provide a valid ' . str_replace('_', ' ', $key) . '.'], 422);
    }
    return $value;
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $config = require __DIR__ . '/config.php';
    $dsn = 'mysql:host=' . $config['host'] . ';dbname=' . $config['database'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

try {
    $action = (string)($_GET['action'] ?? '');
    if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        respond(['csrfToken' => $_SESSION['csrf_token']]);
    }

    require_post();
    $data = input_data();
    $pdo = database();

    switch ($action) {
        case 'register':
            $fields = [
                'student_name' => required_text($data, 'studentName', 120),
                'email' => required_text($data, 'email', 254),
                'mobile' => required_text($data, 'mobile', 10),
                'dob' => required_text($data, 'dob', 10),
                'gender' => required_text($data, 'gender', 30),
                'course' => required_text($data, 'course', 100),
                'academic_year' => required_text($data, 'year', 30),
                'division' => required_text($data, 'division', 20),
                'qualification' => required_text($data, 'qualification', 100),
                'first_preference' => required_text($data, 'firstPreference', 100),
                'second_preference' => required_text($data, 'secondPreference', 100),
                'guardian_name' => required_text($data, 'guardianName', 120),
                'relationship' => required_text($data, 'relationship', 60),
                'emergency_contact' => required_text($data, 'emergencyContact', 10),
            ];
            if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
                respond(['error' => 'Please enter a valid email address.'], 422);
            }
            if (!preg_match('/^[0-9]{10}$/', $fields['mobile']) ||
                !preg_match('/^[0-9]{10}$/', $fields['emergency_contact'])) {
                respond(['error' => 'Phone numbers must contain exactly 10 digits.'], 422);
            }
            $date = DateTime::createFromFormat('!Y-m-d', $fields['dob']);
            if (!$date || $date->format('Y-m-d') !== $fields['dob']) {
                respond(['error' => 'Please enter a valid date of birth.'], 422);
            }
            if ($fields['first_preference'] === $fields['second_preference']) {
                respond(['error' => 'Choose two different course preferences.'], 422);
            }
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 8) {
                respond(['error' => 'Password must be at least 8 characters.'], 422);
            }

            $columns = array_keys($fields);
            $statement = $pdo->prepare(
                'INSERT INTO students (' . implode(', ', $columns) . ', password_hash) VALUES (' .
                implode(', ', array_fill(0, count($columns), '?')) . ', ?)'
            );
            $statement->execute(array_merge(array_values($fields), [password_hash($password, PASSWORD_DEFAULT)]));
            respond(['message' => 'Registration submitted for college verification.']);

        case 'student_login':
            $studentId = required_text($data, 'studentId', 24);
            $password = (string)($data['password'] ?? '');
            $statement = $pdo->prepare(
                "SELECT id, password_hash FROM students WHERE student_id = ? AND status = 'approved'"
            );
            $statement->execute([$studentId]);
            $student = $statement->fetch();
            if (!$student || !password_verify($password, $student['password_hash'])) {
                respond(['error' => 'Student ID or password is incorrect, or the registration is not yet verified.'], 401);
            }
            session_regenerate_id(true);
            $_SESSION['student_record_id'] = (int)$student['id'];
            unset($_SESSION['college_user_id']);
            respond(['message' => 'Login successful.']);

        case 'student_details':
            require_student();
            $statement = $pdo->prepare(
                'SELECT student_id, student_name, email, mobile, dob, gender, course, academic_year AS `year`,
                        division, qualification, first_preference, second_preference, guardian_name,
                        relationship, emergency_contact, attendance, eligibility
                 FROM students WHERE id = ? AND status = \'approved\''
            );
            $statement->execute([$_SESSION['student_record_id']]);
            $student = $statement->fetch();
            if (!$student) {
                unset($_SESSION['student_record_id']);
                respond(['error' => 'Student record could not be found.'], 404);
            }
            respond($student);

        case 'student_logout':
            require_student();
            unset($_SESSION['student_record_id']);
            respond(['message' => 'Logged out.']);

        case 'college_login':
            $collegeId = required_text($data, 'collegeId', 50);
            $password = (string)($data['password'] ?? '');
            $statement = $pdo->prepare('SELECT id, password_hash FROM college_users WHERE college_id = ?');
            $statement->execute([$collegeId]);
            $collegeUser = $statement->fetch();
            if (!$collegeUser || !password_verify($password, $collegeUser['password_hash'])) {
                respond(['error' => 'College ID or password is incorrect.'], 401);
            }
            session_regenerate_id(true);
            $_SESSION['college_user_id'] = (int)$collegeUser['id'];
            unset($_SESSION['student_record_id']);
            respond(['message' => 'Login successful.']);

        case 'college_students':
            require_college();
            $search = trim((string)($data['search'] ?? ''));
            $statement = $pdo->prepare(
                'SELECT id, student_id, student_name, email, mobile, dob, gender, course,
                        academic_year AS `year`, division, qualification, first_preference, second_preference,
                        guardian_name, relationship, emergency_contact, status, attendance, eligibility
                 FROM students
                 WHERE LOWER(student_name) LIKE LOWER(:name)
                    OR LOWER(COALESCE(student_id, \'\')) LIKE LOWER(:student_id)
                 ORDER BY (status = \'pending\') DESC, created_at DESC'
            );
            $statement->execute(['name' => '%' . $search . '%', 'student_id' => '%' . $search . '%']);
            respond($statement->fetchAll());

        case 'approve_student':
            require_college();
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id || $id < 1) {
                respond(['error' => 'Select a valid student registration.'], 422);
            }
            $statement = $pdo->prepare(
                "UPDATE students
                 SET student_id = CONCAT('TCET', YEAR(CURDATE()), LPAD(id, 6, '0')), status = 'approved'
                 WHERE id = ? AND status = 'pending'"
            );
            $statement->execute([$id]);
            if ($statement->rowCount() !== 1) {
                respond(['error' => 'This registration has already been verified or does not exist.'], 409);
            }
            $statement = $pdo->prepare('SELECT student_id FROM students WHERE id = ?');
            $statement->execute([$id]);
            respond(['studentId' => $statement->fetchColumn()]);

        case 'update_attendance':
            require_college();
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $attendance = filter_var($data['attendance'] ?? null, FILTER_VALIDATE_FLOAT);
            if (!$id || $id < 1 || $attendance === false || $attendance < 0 || $attendance > 100) {
                respond(['error' => 'Enter attendance between 0 and 100.'], 422);
            }
            $statement = $pdo->prepare(
                "UPDATE students SET attendance = ? WHERE id = ? AND status = 'approved'"
            );
            $statement->execute([$attendance, $id]);
            if ($statement->rowCount() === 0) {
                $statement = $pdo->prepare("SELECT id FROM students WHERE id = ? AND status = 'approved'");
                $statement->execute([$id]);
                if (!$statement->fetch()) {
                    respond(['error' => 'Verified student record could not be found.'], 404);
                }
            }
            respond(['message' => 'Attendance saved.']);

        case 'college_logout':
            require_college();
            unset($_SESSION['college_user_id']);
            respond(['message' => 'Logged out.']);

        default:
            respond(['error' => 'Unknown request.'], 404);
    }
} catch (PDOException $error) {
    error_log($error->getMessage());
    respond(['error' => 'The database request failed. Check the database setup and try again.'], 500);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['error' => 'The server could not complete the request.'], 500);
}
