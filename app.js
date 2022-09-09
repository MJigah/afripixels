var express = require("express");
var ejs = require("ejs");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var passport = require("passport");
var localStrategy = require("passport-local");
var User = require("./server/model/user");
var expressSession = require("express-session");
var methodOverride = require("method-override");
var controller = require("./server/controller/controller");
var Category = require("./server/model/category");
var Orientation = require("./server/model/orientation");
var Image = require("./server/model/image");
var ImageCategory = require("./server/model/imageCateg");
var ImageOrientation = require("./server/model/imageOrient");
var expressSanitizer = require("express-sanitizer");
const mongoConnect = require("./server/database/database");
mongoConnect();

var app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSession({
    secret: "This is a secret word",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    next();
});
app.use(expressSanitizer());


//Wallpapers, Nature, Wildlife, City

// AUTH ROUTES
app.get("/", function(req, res){
    res.redirect("/afripixels");
});

app.get("/afripixels", function(req, res){
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), "gi");
        console.log(`First: ${req.query.search}`);
        console.log(`First: ${regex}`);
        var search = req.query.search;
        search = search.toUpperCase();
        Category.find({}, (err, allcategory) => {
            if(err){
                console.log(err);
            } else {
                var deter = 0;
                allcategory.forEach((category) => {
                    if(JSON.stringify(req.query.search).toUpperCase() === JSON.stringify(category.name).toUpperCase()){
                        deter = 1;
                    }
                })
                if(deter === 1){
                    Category.findOne({name: search}, function(err, foundCategory){
                        if(err){
                            console.log(`Error: ${err}`);
                        } else {
                            ImageCategory.findOne({categoryId: foundCategory._id}).populate("imageId").exec(function(err, imageCateg){
                                if(err){
                                    console.log(`Error: ${err}`);
                                } else {
                                    res.render("index", {currentUser: req.user, categoryImages: imageCateg.imageId, searchItem: req.query.search, allCategy:foundCategory});
                                }
                            })
                        }
                    })
                } else {
                    if(deter === 0){
                        Category.create({name: search}, function(err, newCategory){
                            if(err){
                                console.log(`Error: ${err}`);
                            } else {
                                ImageCategory.create({
                                    name: newCategory.name,
                                    categoryId: newCategory._id
                                }, function(err, newImageCategory){
                                    if(err){
                                        console.log(`Error: ${err}`);
                                    } else {
                                        res.render("index", {currentUser: req.user, categoryImages: newImageCategory.imageId, searchItem: req.query.search});
                                    }
                                })
                            }
                        })
                    }
                }
            }
        })
    } else {
        Category.find({}, (err, allCategory) => {
            if(err){
                console.log(err);
                res.redirect("back");
            } else {
                Image.find({}).populate("imageId").exec(function(err, allImages){
                    if(err){
                        console.log(`Error: ${err}`);
                    } else {
                        var searchItem = false;
                        res.render("index", {currentUser: req.user, searchItem: searchItem, allCategy:allCategory});
                    }
                })
            }
        });
    }
});


app.get("/register", function(req, res){
    res.render("sign");
});

app.get("/user/:id", isLoggedIn, controller.home);
{}
app.use("/", require("./server/router/router"));

app.post("/register", function(req, res){
    var newUser = {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username:  req.body.username,
        email: req.body.email,
        biodata: req.body.biodata,
        Instagram_handle: req.body.Instagram_handle,
        Twitter_handle: req.body.Twitter_handle
    }
    User.register(new User(newUser), req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("back");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/");
            })
        }
    });
})

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/register"
}), function(req, res){
});

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

app.get("/user/:id/edit", isLoggedIn, function(req, res){
    User.findById(req.params.id, function(err, foundUser){
        if(err){
        console.log(`Error: ${err}`);
        } else {
            console.log(foundUser);
            res.render("edituser", {user: foundUser});
        }
    })
});

app.get("/:id/images/:imageid/edit", isLoggedIn, function(req, res){
    User.findById(req.params.id, function(err, user){
        if(err){
            console.log(err);
        } else {
            Image.findById(req.params.imageid).populate("imageCategory").exec(function(err, foundImage){
                if(err){
                    console.log(err);
                } else {
                    ImageOrientation.findOne({orientationId: foundImage.imageOrientation}, function(err, foundImageOrientation){
                        if(err){
                            console.log(`Error: ${err}`);
                        } else {
                            console.log(foundImage.imageCategory);
                            console.log(foundImageOrientation);
                            console.log(foundImage.imageOrientation);
                            res.render("editimage", {user: user, image: foundImage, imageOrient: foundImageOrientation});
                        }
                    })
                }
            })
        }
    })
});

app.put("/:id/images/:imageid/edit", isLoggedIn, function(req, res){
    User.findById(req.params.id, function(err, foundUser){
        if(err){
            console.log(`Error: ${err}`);
        } else {
            var newCreated = {
                name: req.body.imageOrientation
            };
            var categ = req.body.imageCategory;
            var categy = categ.split(",");
            console.log(categy);
            Image.findByIdAndUpdate(req.params.imageid, newCreated, function(err, foundImage){
                if(err){
                    console.log(`Error: ${err}`);
                } else {
                    categy.forEach((eachCategory) => {
                        eachCategory = eachCategory.toUpperCase();
                        Category.findOne({name: eachCategory}, function(err, foundCateg){
                            if(err){
                                console.log(`Error: ${err}`);
                            } else {
                                console.log(foundCateg);
                                ImageCategory.findOne({categoryId: foundCateg._id}, function(err, foundImageCat){
                                    if(err){
                                        console.log(err)
                                    } else {
                                        ImageOrientation.findOne({name: req.body.imageOrientation}, (err, foundImageOrientation) => {
                                            if(err){
                                                console.log(`Error: ${err}`);
                                            } else {
                                                console.log(foundImageCat);
                                                console.log(foundImageCat.imageId);
                                                if(!((foundImageCat.imageId.includes(foundImage._id)) && (foundImageOrientation.imageId.includes(foundImage._id)))){
                                                    console.log(foundImageCat)
                                                    console.log(foundImageOrientation);
                                                    console.log(foundImageOrientation.imageId);
                                                    foundImageCat.imageId.push(foundImage._id);
                                                    foundImageOrientation.imageId.push(foundImage._id);
                                                    foundImage.imageCategory.push(foundCateg._id);
                                                    foundImageCat.save();
                                                    foundImageOrientation.save();
                                                    foundImage.save();
                                                    console.log(foundImage.imageCategory)
                                                    res.redirect("/"+req.params.id+"/images/"+req.params.imageid+"/edit");
                                                } else {
                                                    console.log(`Repeated id in Image category`);
                                                    res.redirect("/"+req.params.id+"/images/"+req.params.imageid+"/edit");
                                                }
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    })
                }
            })
        }
    })
});

app.put("/user/:id/images/:imageid/sec_edit", isLoggedIn, function(req, res){
    var newName = req.body.name;
    var name = newName.toUpperCase();
    Image.findById(req.params.imageid, function(err, foundImage){
        if(err){
            console.log(err);
        } else {
            Category.create({name: name}, function(err, newCategory){
                if(err){
                    console.log(err);
                } else {
                    ImageCategory.create({
                        name: newCategory.name,
                        categoryId: newCategory._id
                    }, function(err, newImageCat){
                        if(err){
                            console.log(`Error: ${err}`);
                        } else {
                            newImageCat.imageId = foundImage._id
                            newImageCat.save();
                            console.log(newImageCat);
                            foundImage.imageCategory.push(newCategory._id);
                            foundImage.save();
                            console.log(newCategory);
                            res.redirect("/"+req.params.id+"/images/"+req.params.imageid+"/edit");
                        }
                    })
                }
            })
        }
    })
});

app.delete("/:id/images/:imageid/edit", isLoggedIn, function(req, res){
    Image.findByIdAndDelete(req.params.imageid, (err) => {
        if(err){
            console.log(`Error: ${err}`);
        } else {
            res.redirect("back");
        }
    })
})

function escapeRegex(text){
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/register");
};

app.get("*", (req, res) => {
    res.send("This site is not reachable!!");
});

const port = 8000;
app.listen(port, () => {
    console.log(`The server is running on port ${port}`);
});
