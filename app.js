var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
app.set('view engine', 'jade');
app.set('port', process.env.PORT || 3000);

clients = {};
rooms = {}; //hash of rooms. each room should contain an array of client ids.

io.sockets.on('connection', function (socket){
	clients[socket.id] = socket;
	function log(){
		var array = [">>> "];
		for (var i = 0; i < arguments.length; i++) {
			array.push(arguments[i]);
		}
		socket.emit('log', array);
	}

	function getClientsIDInRoom(room){
		var result = [];
		var s = io.sockets.clients(room);
		for (var i in s){
			result.push(s[i].id);
		}
		return result;
	}

	function getClientInRoom(room){

	}

	socket.on('message', function (message) {
		// log('Got message: ', message);
		if (clients[message.to]){			//TODO: maybe of different room, need to take care of this.
			clients[message.to].emit('message', message);
		}
		else {		//fallback, in case there is no such client
			socket.broadcast.emit('message', message); // should be room only
		}
	});

	socket.on('create or join', function (room) {
		var numClients = io.sockets.clients(room).length;

		console.log('Room ' + room + ' has ' + numClients + ' client(s)');
		console.log('Request to create or join room', room);

		if (numClients == 0){
			socket.join(room);
			socket.emit('created', room);
		} else {
			io.sockets.in(room).emit('join', {'room': room, 'id': socket.id});	//introduce
			var clientIdArray = getClientsIDInRoom(room);
			console.log(clientIdArray);
			socket.emit('joined', {'room':room, 'peers': clientIdArray});	//receive greetings
			socket.join(room);
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);
	});

	socket.on('disconnect', function (){
		delete clients[socket.id];
	});
});



app.use('/', express.static(__dirname + '/public'));
server.listen(app.get('port'), function() {
	console.log('listening on port %d', server.address().port );
});

