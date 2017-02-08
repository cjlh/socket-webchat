var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

var users = []
var users_dict = {};
var fingerprints_dict = {};
var banned_fingerprints = [];
var muted_fingerprints = [];

app.use("/public",express.static(__dirname + "/public"));
app.use("/public/js",express.static(__dirname + "/public/js"));
app.use("/public/audio",express.static(__dirname + "/public/audio"));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', function(socket){
	username = socket.handshake.query['username'];
	fingerprint = socket.handshake.query['fingerprint'];
	if(!(banned_fingerprints.indexOf(fingerprint) === -1)) {
		io.to(socket.id).emit('broadcast', 'connection rejected: you are banned');
		console.log('connection refused: user is banned');
        return false;
	}
	if (!(users.indexOf(username.toLowerCase()) === -1)) {
		io.to(socket.id).emit('broadcast', 'connection rejected: that username is already taken');
		console.log('connection refused: attempted to connect as ' + username + ' (' + socket.id + ')');
        return false;
    } else {
    	users_dict[username] = socket.id;
    	fingerprints_dict[username] = fingerprint;
		users.push(username);
    }
	console.log('user ' + username + ' connected (' + socket.id + ')');
	socket.on('disconnect', function(){
		console.log('user ' + username + ' disconnected (' + socket.id + ')');
		var index = users.indexOf(username);
		if (index > -1) {
		    users.splice(index, 1);
		}
		io.emit('user disconnect', username);
	});
	socket.on('chat message', function(data){
		var trim_msg = (data.content).trim();
		if (trim_msg.length > 0) {
			console.log(data.user + ': ' + data.content);
			var slash_check = new RegExp('^' + '/').test(trim_msg);
			if (slash_check) {
				var cmd_check = new RegExp('^' + '/users').test(trim_msg);
				if (cmd_check) {
					user_list = '';
					for (var i = 0; i < users.length; i++) {
						if (i == users.length - 1) {
							user_list = user_list + users[i];
						} else {
							user_list = user_list + users[i] + ', ';
						}
					}
					io.to(socket.id).emit('broadcast', 'users online: ' +  user_list);
				}
				var cmd_check = new RegExp('^' + '/broadcast').test(trim_msg);
				if (cmd_check) {
					var broadcast_msg = trim_msg.substr(trim_msg.indexOf(' ')+1);
					io.emit('broadcast', broadcast_msg);
				}
				var cmd_check = new RegExp('^' + '/kicksocket').test(trim_msg);
				if (cmd_check) {
					var kick_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var kick_socket = users_dict[kick_name];
					if (kick_socket != null) {
						io.to(kick_socket).emit('broadcast', 'you have been kicked');
						io.sockets.connected[kick_socket].disconnect();
						io.emit('broadcast', 'user ' + kick_name + ' was kicked');
					}
				}
				var cmd_check = new RegExp('^' + '/banfingerprint').test(trim_msg);
				if (cmd_check) {
					var ban_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var kick_socket = users_dict[ban_name];
					var ban_fingerprint = fingerprints_dict[ban_name];
					if (ban_fingerprint != null) {
						banned_fingerprints.push(ban_fingerprint);
						io.to(kick_socket).emit('broadcast', 'you have been banned');
						io.sockets.connected[kick_socket].disconnect();
						io.emit('broadcast', 'user ' + ban_name + ' was banned');
					}
				}
				var cmd_check = new RegExp('^' + '/unbanfingerprint').test(trim_msg);
				if (cmd_check) {
					var ban_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var kick_socket = users_dict[ban_name];
					var ban_fingerprint = fingerprints_dict[ban_name];
					if (ban_fingerprint != null) {
						var index = banned_fingerprints.indexOf(ban_fingerprint);
						if (index > -1) {
						    banned_fingerprints.splice(index, 1);
							io.emit('broadcast', 'user ' + ban_name + ' was unbanned');
						}
					}
				}
				var cmd_check = new RegExp('^' + '/mute').test(trim_msg);
				if (cmd_check) {
					var mute_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var mute_fingerprint = fingerprints_dict[mute_name];
					if (mute_fingerprint != null) {
						muted_fingerprints.push(mute_fingerprint);
						io.emit('broadcast', 'user ' + mute_name + ' was muted');
					}
				}
				var cmd_check = new RegExp('^' + '/unmute').test(trim_msg);
				if (cmd_check) {
					var mute_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var mute_fingerprint = fingerprints_dict[mute_name];
					if (mute_fingerprint != null) {
						var index = muted_fingerprints.indexOf(mute_fingerprint);
						if (index > -1) {
						    muted_fingerprints.splice(index, 1);
							io.emit('broadcast', 'user ' + mute_name + ' was unmuted');
						}
					}
				}
				var cmd_check = new RegExp('^' + '/cls').test(trim_msg);
				if (cmd_check) {
					io.emit('clear messages');
				}
				var cmd_check = new RegExp('^' + '/msg').test(trim_msg);
				if (cmd_check) {
					var msg_body = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var msg_user = msg_body.substr(0, msg_body.indexOf(' '));
					var msg_content = msg_body.substr(msg_body.indexOf(' ')+1);
					var msg_socket = users_dict[msg_user];
					if (msg_socket != null && msg_content != null) {
						io.to(msg_socket).emit('incoming pm', { user: data.user, content: msg_content });
						io.to(socket.id).emit('outgoing pm', { user: msg_user, content: msg_content });
					}
				}
				var cmd_check = new RegExp('^' + '/fingerprint').test(trim_msg);
				if (cmd_check) {
					var user_name = trim_msg.substr(trim_msg.indexOf(' ')+1);
					var user_fingerprint = fingerprints_dict[user_name];
					if (user_name != null && user_fingerprint != null) {
						io.to(socket.id).emit('broadcast', 'fingerprint ' + user_name + ': ' + user_fingerprint);
					}
				}
				var cmd_check = new RegExp('^' + '/helpadmin').test(trim_msg);
				if (cmd_check) {
					io.to(socket.id).emit('broadcast', 'valid commands: users, msg, broadcast, kicksocket, fingerprint, banfingerprint, unbanfingerprint, mute, unmute, cls');
				} else {
					var cmd_check = new RegExp('^' + '/help').test(trim_msg);
					if (cmd_check) {
						io.to(socket.id).emit('broadcast', 'valid commands: users, msg');
					}
				}
			} else if (muted_fingerprints.indexOf(fingerprint) === -1) {
				io.emit('chat message', data);
			}
		}
	});
	socket.on('user connect', function(msg){
		io.emit('user connect', msg);
	});
});

http.listen(3000, function(){
	console.log('listening on port 3000');
});