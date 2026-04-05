CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('user', 'creator', 'admin');

CREATE TABLE "user" (
    id      VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    mail    VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    deposit INTEGER DEFAULT 0,
    score   INTEGER DEFAULT 0,
    role    user_role DEFAULT 'user'
);

CREATE TABLE item (
    id          VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    name        VARCHAR NOT NULL,
    points      INTEGER DEFAULT 0,
    description VARCHAR
);

CREATE TABLE box (
    id          VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    name        VARCHAR NOT NULL,
    description VARCHAR,
    cost        INTEGER NOT NULL
);

CREATE TABLE box_to_item (
    id               VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    box_id           VARCHAR NOT NULL REFERENCES box(id) ON DELETE CASCADE,
    item_id          VARCHAR NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    pull_probability INTEGER NOT NULL DEFAULT 1,
    stock            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_items (
    id      VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    user_id VARCHAR NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    item_id VARCHAR NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    box_id  VARCHAR REFERENCES box(id) ON DELETE SET NULL,
    count   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "order" (
    id      VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
    user_id VARCHAR NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    box_id  VARCHAR REFERENCES box(id) ON DELETE SET NULL,
    item_id VARCHAR REFERENCES item(id) ON DELETE SET NULL,
    amount  INTEGER NOT NULL,
    status  VARCHAR NOT NULL DEFAULT 'completed'
);

-- Default admin user: admin@admin.com / admin123
INSERT INTO "user" (mail, password, role, deposit)
VALUES ('admin@admin.com',
        '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        'admin', 10000);
