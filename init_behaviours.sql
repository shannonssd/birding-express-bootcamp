CREATE TABLE behaviours (
  id SERIAL PRIMARY KEY,
  behaviour TEXT
);

INSERT INTO behaviours (behaviour) VALUES ('Walking'), ('Mobbing'), ('Nesting'), ('Flocking');