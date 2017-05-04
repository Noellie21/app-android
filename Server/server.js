var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport	= require('passport');
var config      = require('./config/database'); // get db config file
var User        = require('./app/models/user'); // get the mongoose model
var port        = process.env.PORT || 8080;
var jwt         = require('jwt-simple');
var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
var cors = require('cors');

// get our request parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());
app.use(cors());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// log to console
app.use(morgan('dev'));

// Use the passport package in our application
app.use(passport.initialize());

// demo Route (GET http://localhost:8080)
// connect to database
mongoose.connect(config.database);

// pass passport for configuration
require('./config/passport')(passport);

// bundle our routes
var apiRoutes = express.Router();

// create a new user account (POST http://localhost:8080/api/signup)
apiRoutes.post('/signup', function(req, res) {
  var email = req.body.name;
  if (!req.body.name || !req.body.password) {
    res.json({success: false, msg: 'Please pass email and password.'});
  }
  if (!email.match(/([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)\S+/)) {
    res.json({success: false, msg: 'Please pass a correct email (example@email.com)'});
  }
  else {
    var newUser = new User({
      name: req.body.name,
      password: req.body.password
    });
    // save the user
    newUser.save(function(err) {
      if (err) {
        return res.json({success: false, msg: 'Email already exists.'});
      }
      res.json({success: true, msg: 'Successful created new user.'});
    });
  }
});

apiRoutes.post('/addfriend', function(req, res) {
  User.findOne({
    name: req.body.email
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      res.send({success: false, msg: 'Error. User not found.'});
    } else {
      User.findOne({
        name: req.body.username
      }, function(err, moi) {
        if (err) throw err;
        else {
          moi.friends.push(req.body.email);
          moi.save();
          res.json({success: true, msg: 'Successful Added new Friend.'});
        }
      });
    }
  });
});

apiRoutes.post('/position', function(req, res) {
      User.findOne({
        name: req.body.username
     }, function(err, tata) {
        if (err) throw err;

        if (!tata) {
          res.send({success: false, msg: 'Error. User not found.'});
       }else {
          tata.informations.push({longitude:req.body.longitude,latitude:req.body.latitude,date:req.body.date});
          tata.save();
          res.json({success: true, msg: 'Successful Added new position.'});

      }
   });
  });

apiRoutes.post('/delete', function(req, res) {
  User.findOne({
    name: req.body.username
  }, function(err, moi) {
    if (err) throw err;

    if (!moi) {
      res.send({success: false, msg: 'Error. User not found.'});
    } else {
        moi.friends.pull(req.body.email);
        moi.save();
        res.json({success: true, msg: 'Successful Deleted Friend.'});
    }
  });
});

// route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function(req, res) {
  User.findOne({
    name: req.body.name
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      res.send({success: false, msg: 'Authentication failed. User not found.'});
    } else {
      // check if password matches
      user.comparePassword(req.body.password, function (err, isMatch) {
        if (isMatch && !err) {
          // if user is found and password is right create a token
          var token = jwt.encode(user, config.secret);
          // return the information including token as JSON
          res.json({success: true, token: 'JWT ' + token});
        } else {
          res.send({success: false, msg: 'Authentication failed. Wrong password.'});
        }
      });
    }
  });
});




// route to a restricted info (GET http://localhost:8080/api/memberinfo)
apiRoutes.get('/memberinfo', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true, user});
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

apiRoutes.get('/friendinfo/:p1', passport.authenticate('jwt', { session: false}), function(req, res) {
  console.log("friend info:"+req.params.p1);

  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: req.params.p1
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(404).send({success: false, msg: 'Read position failed. User not found.'});
        } else {
          res.json({success: true, user});
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});


getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// connect the api routes under /api/*
app.use('/api', apiRoutes);

app.get('/', function(req, res) {
  res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// Start the server
app.listen(port);
console.log('There will be dragons: http://localhost:' + port);
