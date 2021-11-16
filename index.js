import pg from 'pg';
import express from 'express';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';

const PORT = process.argv[2];

const { Pool } = pg;

let pgConnectionConfigs;
if (process.env.ENV === 'PRODUCTION') {
  pgConnectionConfigs = {
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
} else {
  pgConnectionConfigs = {
    user: 'shannon',
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
}

const pool = new Pool(pgConnectionConfigs);

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(express.static('public'));
app.use(cookieParser());

// #################### User Auth
// Signup
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', (req, res) => {
  const { email } = req.body;
  const { password } = req.body;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  shaObj.update(password);
  const hashedPassword = shaObj.getHash('HEX');
  const inputData = [email, hashedPassword];
  const sqlQuery = 'INSERT INTO users (email, password) VALUES ($1, $2)';
  pool.query(sqlQuery, inputData, (err, result) => {
    console.log(result.rows);
  });
});

// Login

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const enteredEmail = [req.body.email];
  const enteredPassword = req.body.password;

  const sqlQuery = 'SELECT * FROM users WHERE email = $1';
  pool.query(sqlQuery, enteredEmail, (error, result) => {
    console.log(result.rows);
    if (error) {
      console.log('Error executing query', error.stack);
      res.status(503).send(result.rows);
      return;
    }
    if (result.rows.length === 0) {
      res.status(403).send('Sorry! Please try again!');
      return;
    }
    const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
    shaObj.update(enteredPassword);
    const hashedPassword = shaObj.getHash('HEX');

    if (result.rows[0].password === hashedPassword) {
      // SALT
      const myEnvVar = process.env.MY_ENV_VAR;
      const shaCookieObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
      const unhashedCookieString = `${enteredEmail[0]}-${myEnvVar}`;
      shaCookieObj.update(unhashedCookieString);
      const hashedCookieString = shaCookieObj.getHash('HEX');
      res.cookie('loggedInHash', hashedCookieString);
      res.cookie('userId', enteredEmail[0]);
      res.send('logged in!');
    } else {
      res.send('Sorry! Please try again!').status(403);
    }
  });
});

app.delete('/logout', (req, res) => {
  res.clearCookie('loggedInHash');
  res.clearCookie('userId');
  res.send('Logged out!');
  res.redirect('/login');
});

// #################### BIRD WATCHING NOTES
app.get('/note', (req, res) => {
  const myEnvVar = process.env.MY_ENV_VAR;
  const { loggedInHash, userId } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${userId}-${myEnvVar}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  if (hashedCookieString !== loggedInHash) {
    res.status(403).send('sorry, log in please!');
  } else {
    // Query to retrieve list of species
    const sqlQuery = 'SELECT * FROM species';
    pool.query(sqlQuery, (err, result) => {
      const data = { species: result.rows };
      // New query for list of behaviours
      const behaviourQuery = 'SELECT * FROM behaviours';
      pool.query(behaviourQuery, (behaveErr, behaveResult) => {
        const behaviour = behaveResult.rows;
        data.behaviour = behaviour;
        console.log(data);
        res.render('new-note', data);
      });
    });
  }
});

app.post('/note', (req, res) => {
  const myEnvVar = process.env.MY_ENV_VAR;
  const { loggedInHash, userId } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${userId}-${myEnvVar}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  if (hashedCookieString !== loggedInHash) {
    res.status(403).send('sorry, log in please!');
  } else {
    // Now behaviour can be an array if multiple checkboxes selected
    const { behaviour } = req.body;
    const { date } = req.body;
    const flockSize = req.body.flock_size;
    const { species } = req.body;
    const inputData = [date, Number(flockSize), Number(species)];
    const sqlQuery = 'INSERT INTO notes (date, flock_size, species_id) VALUES ($1, $2, $3) RETURNING *';
    pool.query(sqlQuery, inputData, (err, result) => {
      const notesId = result.rows[0].id;
      const behaviourInsertQuery = 'INSERT INTO notes_behaviour (notes_id, behaviour_id) VALUES ($1, $2)';
      let queryDoneCounter = 0;

      behaviour.forEach((element) => {
        const behaviourInputData = [notesId, element];
        pool.query(behaviourInsertQuery, behaviourInputData, (behaviourErr, behaviourResult) => {
          queryDoneCounter += 1;
          if (queryDoneCounter === behaviour.length) {
            console.log('done!');
            res.redirect('/');
          }
        });
      });
    });
  }
});

app.get('/note/:id', (req, res) => {
  const myEnvVar = process.env.MY_ENV_VAR;
  const { loggedInHash, userId } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${userId}-${myEnvVar}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  if (hashedCookieString !== loggedInHash) {
    res.status(403).send('sorry, log in please!');
  } else {
    const { id } = req.params;
    const sqlQuery = `SELECT * FROM notes WHERE id = ${id}`;
    pool.query(sqlQuery, (err, result) => {
      const data = result.rows[0];
      res.render('note', data);
    });
  }
});

// const verifyLogin = (req) => {
//   const myEnvVar = process.env.MY_ENV_VAR;
//   const { loggedInHash, userId } = req.cookies;
//   const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
//   const unhashedCookieString = `${userId}-${myEnvVar}`;
//   shaObj.update(unhashedCookieString);
//   const hashedCookieString = shaObj.getHash('HEX');
// };

app.get('/', (req, res) => {
  const myEnvVar = process.env.MY_ENV_VAR;
  const { loggedInHash, userId } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${userId}-${myEnvVar}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  // verifyLogin(req);
  if (hashedCookieString !== loggedInHash) {
    res.status(403).send('sorry, log in please!');
  } else {
    const sqlQuery = 'SELECT * FROM notes';
    pool.query(sqlQuery, (err, result) => {
      const array = result.rows;
      res.render('notes-list', { array });
    });
  }
});

app.listen(PORT);
