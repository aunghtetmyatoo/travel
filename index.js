const express = require("express");
const app = express();

const mongojs = require("mongojs");
const db = mongojs("travel", ["records"]);

const bodyParser = require("body-parser");

const cors = require("cors");
app.use(cors());    

const {
    body,
    param,
    validationResult
} = require("express-validator")

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// JWT
const jwt = require("jsonwebtoken");
const secret = "horse battery staple";

// Auth Data
const users = [
    { username: 'Alice', password: 'password', role: 'admin' },
    { username: 'Bob', password: 'password', role: 'user' },
];

// Auth Middlewares
function auth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if(!authHeader) return res.sendStatus(401);

    const [ type, token ] = authHeader.split(' ');
    if(type !== "Bearer") return res.sendStatus(401);

    jwt.verify(token, secret, function(err, data) {
        if(err) return res.sendStatus(401);
        else next();
    });

    next();
}

function onlyAdmin(req, res, next) {
    const [ type, token ] = req.headers['authorization'].split(' ');

    jwt.verify(token, secret, function(err, data) {
        if(data.role === "admin") next();
        else return res.sendStatus(403);
    });
    next();
}

// Login
app.post('/api/login', function(req, res) {
    const { username, password } = req.body;
    const auth = users.find(function(u) {
        return u.username === username && u.password === password;
    });

    if(auth) {
        jwt.sign(auth, secret, { expiresIn: '1h' }, function(err, token) {
            return res.status(200).json({ token });
        });
    } else {
        return res.sendStatus(401);
    }
});

app.get("/api/records", function(req, res) {
    const options = req.query;

    const sort = options.sort || {};
    const filter = options.filter || {};
    const limit = 10;
    const page = parseInt(options.page) || 1;
    const skip = (page - 1) * limit;

    for(i in sort) {
        sort[i] = parseInt(sort[i]);
    }

    db.records.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit, function(err, data) {
            if(err) {
                return res.sendStatus(500);
            } else {
                return res.status(200).json({
                    meta: { 
                        skip,
                        limit,
                        sort,
                        filter,
                        page,
                        total: data.length
                    },
                    data,
                    links: {
                        self: req.originalUrl,
                    }
                });
            }
        });
});

app.post("/api/records", [
    body("name").not().isEmpty(),
    body("from").not().isEmpty(),
    body("to").not().isEmpty(),
], function(req, res) {
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    db.records.insert(req.body, function(err, data) {
        if(err) {
            return res.status(500);
        }

        const _id = data._id;

        res.append("Location", "/api/records/" + _id);
        return res.status(201).json({ meta: _id, data });
    })
});

app.put("/api/records/:id", [
    param("id").isMongoId()
], function(req, res) {
    const _id = req.params.id;

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    db.records.count({
        _id: mongojs.ObjectID(_id)
    }, function(err, count) {
        if(count) {
            const record = {
                _id: mongojs.ObjectID(_id),
                ...req.body
            };
            db.records.save(record, function(err, data) {
                return res.status(200).json({
                    meta: { _id },
                    data
                });
            });
        } else {
            db.records.save(req.body, function(err, data) {
                return res.status(201).json({
                    meta: { _id: data._id },
                    data
                });
            });
        }
    });
});

app.patch("/api/records/:id", function(req, res) {
    const _id = req.params.id;

    db.records.count({
        _id: mongojs.ObjectID(_id)
    }, function(err, count) {
        if(count) {
            db.records.update(
                { _id: mongojs.ObjectID(_id) },
                { $set: req.body },
                { multi: false },
                function(err, data) {
                    db.records.find({
                        _id: mongojs.ObjectID(_id)
                    }, function(err, data) {
                        return res.status(200).json({
                            meta: { _id },
                            data
                        })
                    })
                }
            )
        } else {
            return res.sendStatus(404);
        }
    });
});

app.delete("/api/records/:id", function(req, res) {
    const _id = req.params.id;

    db.records.count({
        _id: mongojs.ObjectID(_id)
    }, function(err, count) {
        if(count) {
            db.records.remove({
                _id: mongojs.ObjectID(_id)
            }, function(err, data) {
                return res.sendStatus(204);
            })
        } else {
            return res.sendStatus(404);
        }
    })
});

app.listen(8000, function() {
    console.log("Server running at port 8000...");
});


