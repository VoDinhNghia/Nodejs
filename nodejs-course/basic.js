var express = require("express");
var mysql=require("mysql");
var bodyParser = require('body-parser');
var passport=require("passport");
//var bcrypt = require('bcrypt');
var session = require('express-session');
var crypto  = require('crypto');
var LocalStrategy = require('passport-local').Strategy
var app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

var server=require("http").Server(app);
var io=require("socket.io")(server);
server.listen(8888);
//app.listen(8888);
var con=mysql.createConnection({
   host: "localhost",
   user: "root",
   password: "",
   database: "nodejs"
});

con.connect(function (err){
    console.log("Kết nối tới xampp thành công");
    if (err) throw err.stack;
    var sql = "SELECT * FROM city";
    con.query(sql, function (err,results, fields) {
        if (err) throw err;
        console.log("Truy vấn data thành công");
       // console.log(results);
    });
});

//app.use(flash());
app.use(passport.initialize());
app.use(bodyParser.json());
app.get(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret : "secret",
  saveUninitialized: true,
  resave: true
}));

app.use(session({
    secret: 'something',
    cookie: {
        maxAge: 1000 * 50 * 5 //đơn vị là milisecond
    }
}));
app.use(passport.session());
app.post('/dangnhap', function (request, response){
  var body = request.body;
  var email=request.body.email;
  var pass=request.body.pass;
  if(email==" " || pass<6 ){
    console.log("Không đăng nhập được!");
    return false;
  }else{
    console.log(email+  " đang đăng nhập vào hệ thống");
    con.query("select * from dangnhap where email = ?", [email], function(err, rows){
           console.log(rows);
           var dbemail  = rows[0].email;
          // console.log(dbemail);
          if(dbemail=="admin@gmail.com"){
            console.log(dbemail);
            app.get("/thongtin_hv", function(request, response) {
              con.query('select * from dangki', function (error, results, fields) {
                console.log(results);
                 response.send(results);
               });
            });
            return false;
          }
           if((dbemail != email) || (email==" ")){
             console.log("đăng nhập thất bại");
             return false;
           }else {
             console.log("đăng nhập thành công");
             app.get('/thongtinhv', function(request, response) {
               response.redirect('/thongtinhv') ;
             });
             return false;
           }
    });
    return false;
  }
});

app.post('/dangki', function (request, response) {
    var body = request.body;
    var hoten=request.body.hoten;
    var pass=request.body.pass;
    var email=request.body.email;
    var sdt=request.body.sdt;
    if(hoten==" " || email==" " || pass.length< 5 || sdt==""){
      console.log("Không đăng kí được!");
      return false;
    }else{
      console.log("ho ten "+hoten+" password is "+pass+ " email "+email+" sdt "+sdt+ " đã đăng kí học viên thành công");
      var sql="insert into dangki values('"+request.body.hoten+"','"+request.body.pass+"','"+request.body.email+"','"+request.body.sdt+"')";
      var sql_dn="insert into dangnhap values('"+request.body.email+"','"+request.body.pass+"')";
      con.query(sql, function(err) {
         console.log("Thêm học viên thành công");
      });
      con.query(sql_dn, function(err) {
          console.log("Thêm vào bảng đăng nhập thành công");
      });
      return false;
    }
    var sql_dk = "SELECT * FROM dangki";
    con.query(sql_dk, function (err,results, fields) {
        if (err) throw err;
        //console.log(results);
    });
     //console.log(body);
     //response.redirect("http://localhost:8888/thongtinhv");
});

var mang_hv=["a@gmail.com"];
var mang_user=[""];
io.on("connection", function(socket) {
  socket.on("dang-ki-hoc-vien", function(d) {
    if (mang_hv.indexOf(d)>=0) {
      socket.emit("dk-that-bai");
      console.log(d + " đăng kí học viên thất bại!");
    }else {
      mang_hv.push(d);
      socket.Username=d;
      socket.emit("dki-thanhcong", d);
      console.log(d + " đăng kí học viên thành công!");
      io.sockets.emit("server-send-danhsach-Users", mang_hv);
    }
  });
});

console.log("Đang kết nối tới port 8888 địa chỉ ip: 127.0.0.1");
//thông báo có người truy cập, ngắt kết nối và địa chỉ id
io.on("connection", function(socket) {
  console.log("Có người đang truy cập: " +socket.id);
  socket.on("disconnect", function() {
    console.log(socket.id +" Đã ngắt kết nối!!!");
  });
// đăng kí trò chuyện trên form chat nhóm
  socket.on("client-send-Username", function(data) {
    if (mang_user.indexOf(data)>=0) {
      socket.emit("server-send-dki-thatbai");
      console.log(data  + " đăng kí trò chuyện thất bại!");
    }else {
      mang_user.push(data);
      socket.Username=data;
      socket.emit("server-send-dki-thanhcong", data);
      console.log(data  + " đăng kí trò chuyện thành công!");
      io.sockets.emit("server-send-danhsach-Users", mang_user);
    }
  });
  //đăng xuất khỏi nhóm trò chuyện
  socket.on("logout", function() {
    mang_user.splice(
      mang_user.indexOf(socket.data), 1
    );
    socket.broadcast.emit("server-send-danhsach-Users", mang_user );
    console.log(socket.Username+ " đã logout khỏi nhóm chat");
  });
  //hiển thị nội dung cuộc trò chuyện trên listmessages
  socket.on("user-send-message", function(data) {
    io.sockets.emit("server-send-message", {un:socket.Username, nd:data});
  });
  //nhận thông tin thắc mắc từ user
  socket.on("User-send-thacmac", function(data) {
    console.log(data + " thắc mắc cần được tư vấn từ: " + socket.id);
  });
//Thông báo có người đang nhập tin nhắn
  socket.on("toi-dang-go-chu", function() {
    console.log(socket.Username + " đang nhập tin nhắn!");
    var s=socket.Username + " đang nhập tin nhắn";
    io.sockets.emit("ai-dang-nhap-tin-nhan", s);
  });
// thông báo có người dừng nhập tin nhắn
  socket.on("toi-dung-go-chu", function() {
    console.log(socket.Username + " đã dừng nhập tin nhắn!");
    var s=socket.Username;
    io.sockets.emit("ai-dung-nhap-tin-nhan");
  });
});

app.get("/", function(request, response)  {
    response.render("index");
});
app.get("/thongtinhv", function(request, response)  {
   response.render("thongtinhv");
});
app.get("/gioithieu", function(request, response)  {
    response.render("gioithieu");
});
app.get("/thongtin_hv", function(request, response)  {
   con.query('select * from dangki', function (error, results, fields) {
  //if (error) throw error;
  //console.log(results);
      //response.render("thongtin_hv");
      response.send(results);
       //console.log(results);
   });
});
app.get("/lienhe1", function(request, response)  {
    response.render("lienhe1");
});
app.get("/gt_html", function(request, response)  {
    response.render("gt_html");
});
app.get("/gt_css", function(request, response)  {
    response.render("gt_css");
});
app.get("/gt_jq", function(request, response)  {
    response.render("gt_jq");
});
app.get("/gt_js", function(request, response)  {
    response.render("gt_js");
});
app.get("/gt_bt", function(request, response)  {
    response.render("gt_bt");
});
app.get("/gt_aj", function(request, response)  {
    response.render("gt_aj");
});
app.get("/gt_nodejs", function(request, response)  {
    response.render("gt_nodejs");
});
app.get("/gt_php", function(request, response)  {
    response.render("gt_php");
});
app.get("/thanhtoan", function(request, response)  {
    response.render("thanhtoan");
});
app.get("/tim_nodejs", function(request, response)  {
    response.render("tim_nodejs");
});
app.get("/tim_html", function(request, response)  {
    response.render("tim_html");
});
app.get("/tim_css", function(request, response)  {
    response.render("tim_css");
});
app.get("/tim_js", function(request, response)  {
    response.render("tim_js");
});
app.get("/tim_jq", function(request, response)  {
    response.render("tim_jq");
});
app.get("/tim_bt", function(request, response)  {
    response.render("tim_bt");
});
app.get("/tim_aj", function(request, response)  {
    response.render("tim_aj");
});
app.get("/tim_php", function(request, response)  {
    response.render("tim_php");
});
app.get("/dangki", function(request, response)  {
    response.render("dangki");
});
app.get("/dangnhap", function(request, response)  {
    response.render("dangnhap");
});
app.get("/thongtin_hv1", function(request, response)  {
    response.render("thongtin_hv1");
});
//console.log("Đang kết nối tới port 8888");
