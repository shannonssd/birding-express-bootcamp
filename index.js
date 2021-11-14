import pg from 'pg';
import express from 'express';
import methodOverride from 'method-override';

const { Pool } = pg;

const pgConnectionConfigs = {
  user: 'shannon',
  host: 'localhost',
  database: 'birding',
  port: 5432,
};

const pool = new Pool(pgConnectionConfigs);

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(express.static('public'));

app.get('/note', (req, res) => {
  res.render('new-note');
});

app.post('/note', (req, res) => {
  const { date } = req.body;
  const { behaviour } = req.body;
  const flockSize = req.body.flock_size;
  const inputData = [date, behaviour, Number(flockSize)];
  console.log(inputData);
  const sqlQuery = 'INSERT INTO notes (date, behaviour, flock_size) VALUES ($1, $2, $3)';
  pool.query(sqlQuery, inputData, (err, result) => {
    console.log(result.rows);
  });
});

app.get('/note/:id', (req, res) => {
  const { id } = req.params;
  const sqlQuery = `SELECT * FROM notes WHERE id = ${id}`;
  pool.query(sqlQuery, (err, result) => {
    const data = result.rows[0];
    console.log(data);
    res.render('note', data);
  });
});

app.get('/', (req, res) => {
  const sqlQuery = 'SELECT * FROM notes';
  pool.query(sqlQuery, (err, result) => {
    const array = result.rows;
    console.log(array);
    res.render('notes-list', { array });
    console.log({ array });
  });
});

app.listen(3004);
