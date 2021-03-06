
require('dotenv').config();
const express= require('express');
const bodyParser= require('body-parser');
const mongoose = require('mongoose');
const multer= require('multer');
const path=require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const bcrypt=require('bcrypt');
const async=require('async');
const crypto=require('crypto');
const nodemailer=require('nodemailer');
const sgTransport=require('nodemailer-sendgrid-transport');
const sgMail=require('@sendgrid/mail')
const sgkey=process.env.SENDGRID_API_KEY;
sgMail.setApiKey("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");
const Transporter = nodemailer.createTransport(sgTransport({    
  auth: {  
    api_key:"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",
  }  
}));

const isAuth = require('./middleware/is-auth.js');

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};


const app= express();

const store = new MongoDBStore({
  uri: "mongodb+srv://admin-yatharth:milenovo@gameapp-i8jer.mongodb.net/gameApp?retryWrites=true&w=majority",
  collection: 'sessions',
});


app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));
app.use(express.static(__dirname+'/uploads'))
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('img')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use(session({
    secret:"I will not tell you my secret you are good",
    resave:false,
    saveUninitialized:false,
    store:store
}));



app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  next();
});




mongoose.connect("mongodb+srv://admin-yatharth:milenovo@gameapp-i8jer.mongodb.net/gameApp?retryWrites=true&w=majority",{useNewUrlParser:true,useUnifiedTopology: true, useFindAndModify:false});

const userSchema= new mongoose.Schema({
    firstName:String,
    lastName:String,
    username:String,
    password:String,
    resetToken: String,
  resetTokenExpiration: Date,
  cart: {
    items: [
      {
      }
    ]
  }

})


const gameSchema=new mongoose.Schema({
  gameName:String,
  devName:String,
  genre:String,
  desc:String,
  image:Object,
})

const orderSchema= new mongoose.Schema({
  email:String,
  user: {
    email: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    }
  },
    games: {
      type: mongoose.Schema.Types.Object,
      required: true,
    }
      
    
    

})


const Game=mongoose.model("game",gameSchema);

const Order=mongoose.model("order",orderSchema);
const User=mongoose.model("user",userSchema);

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    
});



app.get("/",function(req,res){
  Game.find().sort({ _id: -1 }).exec(function(err,result){
  
  if(req.session.isLoggedIn){
    res.render("index",{isAuthenticated:true, games:result})
  }
  else{
    res.render("index",{isAuthenticated:false,games:result})
  }
})
    
})



app.get("/login",function(req,res){
  if(req.session.isLoggedIn==true){
    res.redirect('/');
    return;
  }
    res.render("login",{msg:""});

})

app.post("/login",function(req,res){
  
  const email = req.body.username;
  const password = req.body.password;


  User.findOne({ username: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('login', {
          msg: 'User does not exist',
        });
      }
      bcrypt
        .compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              res.redirect('/');
            });
          }
          return res.status(422).render('login', {
            msg: 'Invalid email or password.',
          });
        })
        .catch(err => {
          console.log(err);
          res.redirect('/login');
        });
    })  
    
  
})

app.get('/logout', function(req, res){
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
  });


app.get("/games",function(req,res){
  Game.find({},function(err, result){
    res.render("games",{games:result});
  })
})

app.get("/games/:genre",function(req,res){
  Game.find({"genre":req.params.genre},function(err,result){
    res.render("games",{games:result})
  })
})

app.get("/products/:gameId",function(req,res){
  const gameId = req.params.gameId;
  Game.findById(gameId)
    .then(product => {
      res.render('game-detail', {
        product: product,
        pageTitle: product.gameName,
        path: '/products'
      });
    })
    
})

app.get("/gameInsert",isAuth,function(req,res){
        res.render("gameInsert",{msg:""});
        
})

app.get("/signUp",function(req,res){
    res.render("signUp",{msg:""});
})


app.post("/signup",function(req,res){

  const email = req.body.username;
  const firstName=req.body.firstName;
  const lastName=req.body.lastName;
  const password = req.body.password;
  User.find({username:email},function(err,user){
    if(user.length){
      res.render("signUp",{msg:"User already exist"})
    }
    else{
      bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      const user = new User({
        firstName:firstName,
        lastName:lastName,
        username: email,
        password: hashedPassword,
        cart: { items: [] }
      });
      return user.save();
    })
    .then(result => {
      res.redirect('/login');
      // return transporter.sendMail({
      //   to: email,
      //   from: 'shop@node-complete.com',
      //   subject: 'Signup succeeded!',
      //   html: '<h1>You successfully signed up!</h1>'
      // });
    })
    }
  })
  
    
    
  
})

app.get("/forgot_password",function(req,res,next){   
       res.render("forgotpassword",{msg:"forgot"})   
})

app.post("/forgot_password",function(req,res,next){

    async.waterfall([  
        function(done) {  
            crypto.randomBytes(20, function(err, buf) {  
                var token = buf.toString('hex');  
                done(err, token);  
            });  
        },  
        function(token, done) {   
                var query = { username : req.body.email };  
                User.find(query,function(err,result){  
                    if(result.length == 0){  
                        res.render("forgotpassword",{msg:'No account with that email address exists.'} );  
                    }
                    else{  
                    var myquery = { username: result[0].username };  
                    var newvalues = { $set: {resetToken: token, resetTokenExpiration: Date.now()}};  
                    User.updateOne(myquery, newvalues, function(err, res) {  
                         
                    });  


                   // console.log(result[0].Email);  
                    done(err, token, result);  
                  }
                });    
        },  
        function(token, result, done,Username,password) {  
            var emailVal = result[0].username;    
            var Username=result[0].username;  
            var password=result[0].password;  
                
               // console.log(Username);  
               // console.log(password);  
                   // res.json({status : 'success', message : 'Records found', result : result});  


            // console.log(Username);  
              

            const msg = {  
                to: emailVal,  
                from: 'yatharth570@gmail.com',  
                subject: 'Node.js Password Reset',  
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account. This link will be valid for 15 minutes.\n\n' +  
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +  
                    'http://' + req.headers.host + '/reset/'+ emailVal +'/' + token + '\n\n' +  
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'  
            };  
            sgMail.send(msg, function(err) {                 
 
                if(err)
                console.log(err);
                else
                res.render("forgotpassword",{msg:"An e-mail has been sent to " + emailVal + " with further instructions."});              
                done(err, 'done');  
            }); 
          
        }  

    ], function(err) {  
        if (err) return next(err);  

    });  
})


app.get("/reset/:email/:token",function(req,res){
  const email=req.params.email;
  const token=req.params.token;
  User.find({username:email,resetToken:token},function(err,result){
    var dateobj = new Date(); 
    var now = dateobj.toISOString();
    if(result[0].resetTokenExpiration<now){
      res.render("resetpass",{action:"/reset/"+email+"/"+token});
    }
    else{
      res.render("forgotpassword",{msg:'Token Expired'});
    }
  })
})

app.post("/reset/:email/:token",function(req,res){
  const email=req.params.email;
  const token=req.params.token;
  const password=req.body.password;
  User.find({username:email,resetToken:token},function(err,result){
    if(result.length == 0){  
      res.render("forgotpassword",{msg:'No account with that email address exists.'} );  
  }
  else{    
    bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      User.updateOne({username:email},{$set:{password:hashedPassword}}, function(err, res) {  
        if(err)
        console.log(err);
        else
        console.log("1 document updated");
      });
    })
    .then(result => {
      res.render("forgotpassword",{msg:'Password changed successfully.'} );
    })
      
  }

})
});


app.post("/cart",isAuth,function(req,res,next){
  const gameId = req.body.productId;
  const userId = req.session.user._id;
  Game.findById(gameId)
    .then(product => {
        req.user.cart.items.push(product);
        req.user.save()
    })
    .then(result => {
      res.redirect('/cart');
    })
})
app.get("/cart",isAuth,function(req,res,next){
  const items=req.user.cart.items
  if(items){
    res.render('cart', {
      path: '/cart',
      pageTitle: 'Your Cart',
      products: items
    });
}
})
    

app.post('/gameInsert', (req, res) => {
  Game.find({gameName:req.body.gameName},function(err,result){
    if(typeof result !== 'undefined' && result.length > 0){
      res.render("gameInsert",{msg:"Game Already Exist"});

    }
    else{
      let newGame=new Game({
        gameName:req.body.gameName,
        devName:req.body.developerName,
        genre:req.body.genre,
        desc:req.body.desc,
        image:req.file.path,
      })
      newGame.save();
      res.redirect("/games")
    }
  })
  
})
   
app.post("/cart-delete-item",function(req,res){
    const prodId = req.body.productId
    console.log(req.user.cart);
    req.user.update(
        { $pull: { 'cart.items': { "gameName": prodId }}},
        function(err,result){
          res.redirect("/cart")
   }
    )
})

app.post("/create-order",isAuth,function(req,res){
  product=req.user.cart.items
  if(typeof product !== 'undefined' && product.length ==0){
   res.redirect("/cart");
  }
  else{
    const order = new Order({
      user: {
        email: req.user.username,
        userId: req.user._id
      },
      games:product
      
    });
    order.save();
    req.user.update(
      { $pull: { 'cart.items': {}}},
      function(err,result){
        res.redirect("/orders")
  }
  )
  }
  
})

app.get("/orders",isAuth,function(req,res){
  Order.find({ 'user.email': req.user.username },function(err,result){
    console.log(result)
    res.render('orders', {
      path: '/orders',
      order: result
    });
  })
})


const PORT=process.env.PORT;
app.listen(PORT||3000,function(){
    console.log("server started");
});


//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