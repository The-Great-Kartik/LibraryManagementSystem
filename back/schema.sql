-- 1. create and select the database
create database if not exists library_db;
use library_db;

-- 2. create all independent tables first
create table roles (
    role_id int primary key auto_increment,
    role_name varchar(50) not null,
    max_books_allowed int not null,
    borrow_duration_days int not null,
    fine_rate_per_day decimal(5,2) not null
);

create table publishers (
    publisher_id int primary key auto_increment,
    name varchar(100) not null,
    contact_email varchar(100),
    address text
);

create table authors (
    author_id int primary key auto_increment,
    first_name varchar(50) not null,
    last_name varchar(50) not null,
    bio text
);

create table categories (
    category_id int primary key auto_increment,
    category_name varchar(100) not null,
    floor_number int,
    rack_code varchar(20)
);

create table courses (
    course_id int primary key auto_increment,
    course_code varchar(20) not null,
    course_name varchar(100) not null,
    department varchar(100)
);

-- 3. create tables with foreign keys
create table users (
    user_id int primary key auto_increment,
    role_id int,
    first_name varchar(50) not null,
    last_name varchar(50) not null,
    email varchar(100) unique not null,
    password_hash varchar(255) not null,
    phone varchar(15),
    account_status varchar(20) default 'active',
    max_books_allowed int default null,
    created_at timestamp default current_timestamp,
    foreign key (role_id) references roles(role_id)
);

create table books (
    book_id int primary key auto_increment,
    isbn varchar(20) unique,
    title varchar(255) not null,
    publisher_id int,
    edition varchar(50),
    publication_year int,
    total_copies int default 0,
    foreign key (publisher_id) references publishers(publisher_id)
);

create table book_authors (
    book_id int,
    author_id int,
    primary key (book_id, author_id),
    foreign key (book_id) references books(book_id),
    foreign key (author_id) references authors(author_id)
);

create table book_categories (
    book_id int,
    category_id int,
    primary key (book_id, category_id),
    foreign key (book_id) references books(book_id),
    foreign key (category_id) references categories(category_id)
);

create table course_books (
    course_id int,
    book_id int,
    suggestion_type varchar(50),
    primary key (course_id, book_id),
    foreign key (course_id) references courses(course_id),
    foreign key (book_id) references books(book_id)
);

create table book_items (
    barcode_id varchar(50) primary key,
    book_id int,
    shelf_slot varchar(50),
    acquisition_date date,
    status varchar(20) default 'available',
    foreign key (book_id) references books(book_id)
);

create table borrow_records (
    borrow_id int primary key auto_increment,
    user_id int,
    barcode_id varchar(50),
    issue_date date,
    due_date date,
    return_date date,
    issued_by_librarian_id int,
    foreign key (user_id) references users(user_id),
    foreign key (barcode_id) references book_items(barcode_id),
    foreign key (issued_by_librarian_id) references users(user_id)
);

create table reservations (
    reservation_id int primary key auto_increment,
    book_id int,
    user_id int,
    reservation_date timestamp default current_timestamp,
    queue_position int,
    status varchar(20) default 'active',
    foreign key (book_id) references books(book_id),
    foreign key (user_id) references users(user_id)
);

create table fines_and_payments (
    transaction_id int primary key auto_increment,
    borrow_id int,
    user_id int,
    amount_assessed decimal(10,2),
    amount_paid decimal(10,2) default 0.00,
    status varchar(20) default 'unpaid',
    payment_date date,
    payment_method varchar(50),
    foreign key (borrow_id) references borrow_records(borrow_id),
    foreign key (user_id) references users(user_id)
);

create table book_requests (
    request_id int primary key auto_increment,
    user_id int,
    book_title varchar(255) not null,
    author_name varchar(100),
    isbn varchar(20),
    status varchar(20) default 'pending',
    created_at timestamp default current_timestamp,
    foreign key (user_id) references users(user_id)
);

create table request_upvotes (
    request_id int,
    user_id int,
    upvoted_at timestamp default current_timestamp,
    primary key (request_id, user_id),
    foreign key (request_id) references book_requests(request_id),
    foreign key (user_id) references users(user_id)
);

-- 4. insert initial roles and test user
insert into roles (role_id, role_name, max_books_allowed, borrow_duration_days, fine_rate_per_day) values
(1, 'admin', 0, 0, 0.00),
(2, 'teacher', 10, 30, 0.00),
(3, 'student', 3, 14, 5.00);

insert into users (role_id, first_name, last_name, email, password_hash, phone) values
(3, 'test', 'user', 'student@college.edu', 'password123', '9876543210');