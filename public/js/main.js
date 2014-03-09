'use strict';

var sendChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

sendButton.onclick = sendData;

var isChannelReady;
var localStream;
var turnReady;
var peersNum = 0;
var sessionID2Peer = {} //hash session id to peer RTCPeerConnection object.
var stack = [];
var turnServer = {username: 'linh_nguyen_hien%40nus.edu.sg',
turn: 'numb.viagenie.ca:3478',
password: 'iamathere'};

var pc_config = {'iceServers':[{'url':'stun:stun.l.google.com:19302'}]}; // number IP


var pc_constraints = {
  'optional': [
  {'DtlsSrtpKeyAgreement': true},
  {'RtpDataChannels': true}
  ]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

/////////////////////////////////////////////

var room = location.pathname.substring(1);
if (room === '') {
 room = prompt('Enter room name:');
// room = 'foo';
} else {
  //
}
var localVideo = document.querySelector('#localVideo');

var socket = io.connect();


socket.on('created', function (room){
  console.log('Created room ' + room);
});

socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
});

/*
expected from server: 
  {'room': room, 'id': socket.id} 
where room is room name, id is sessionId of the new guy
*/
socket.on('join', function (data){
  console.log('Another peer made a request to join room ' + data.room);
  var peer = createPeerConnection(data.id);
  sessionID2Peer[data.id] = peer;
  isChannelReady = true;
});

/*
expect from server:
  {'room':room, 'peers': peers}
where room is room name
peers is an array of sessionId of other guy already in the room.
*/
socket.on('joined', function (data){
  console.log('This peer has joined room ' + data.room);
  isChannelReady = true;
  console.log(data);
  for (var i in data.peers){
    console.log(data.peers[i]);
    var peer = createPeerConnection(data.peers[i]);
    sessionID2Peer[data.peers[i]] = peer;
  }
  doCall();
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message){
	console.log('Sending message: ', message);
  socket.emit('message', message);
}

/*
expecting from server:
{to: sessionID1, from: sessionID2, data: message}
*/
socket.on('message', function (msg){
  console.log('Received message:', msg);
  if (msg === 'bye'){
    handleRemoteHangup();
  }
  else if (msg.data.type === 'offer') {
    doAnswer(msg);
  } else if (msg.data.type === 'answer') {
    var pc = sessionID2Peer[msg.from];
    pc.setRemoteDescription(new RTCSessionDescription(msg.data));
  } else if (msg.data.type === 'candidate') {      //assuming peers already in list.
    var candidate = new RTCIceCandidate({sdpMLineIndex:msg.data.label,
      sdpMid:msg.data.id,
      candidate:msg.data.candidate});
    var pc = sessionID2Peer[msg.from];
    if (!pc.remoteDescription){
      stack.push(candidate);
    }
    else {
      console.log('adding ice candidate');
      pc.addIceCandidate(candidate);
    }
  }
});

////////////////////////////////////////////////////



function handleUserMedia(stream) {
  localStream = stream;
  attachMediaStream(localVideo, stream);
  console.log('Adding local stream.');
  if (room !== '') {
    console.log('Create or join room', room);
    socket.emit('create or join', room);
  }
}

function handleUserMediaError(error){
  console.log('getUserMedia error: ', error);
}

var constraints = {video: true, audio: true};

getUserMedia(constraints, handleUserMedia, handleUserMediaError);
console.log('Getting user media with constraints', constraints);

window.turnserversDotComAPI.iceServers(function(data) {
  pc_config['iceServers'].push(data);
});

window.onbeforeunload = function(e){
	sendMessage('bye');
}

/////////////////////////////////////////////////////////

function createPeerConnection(sessionId) {
  var pc;
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    var callback = function(ev) {
      handleIceCandidate(ev, sessionId);
    }
    pc.onicecandidate = callback;
    console.log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
  } catch (e) {
    console.log(e);
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;
  pc.addStream(localStream);
  pc.onnegotiationneeded = function() {
    console.log('negotiating');
  }
  // if (isInitiator) {
  //   try {
  //     // Reliable Data Channels not yet supported in Chrome
  //     sendChannel = pc.createDataChannel("sendDataChannel",
  //       {reliable: false});
  //     sendChannel.onmessage = handleMessage;
  //     trace('Created send data channel');
  //   } catch (e) {
  //     alert('Failed to create data channel. ' +
  //       'You need Chrome M25 or later with RtcDataChannel enabled');
  //     trace('createDataChannel() failed with exception: ' + e.message);
  //   }
  //   sendChannel.onopen = handleSendChannelStateChange;
  //   sendChannel.onclose = handleSendChannelStateChange;
  // } else {
  //   pc.ondatachannel = gotReceiveChannel;
  // }
  return pc;
}

function sendData() {
  var data = sendTextarea.value;
  sendChannel.send(data);
  trace('Sent data: ' + data);
}

// function closeDataChannels() {
//   trace('Closing data channels');
//   sendChannel.close();
//   trace('Closed data channel with label: ' + sendChannel.label);
//   receiveChannel.close();
//   trace('Closed data channel with label: ' + receiveChannel.label);
//   localPeerConnection.close();
//   remotePeerConnection.close();
//   localPeerConnection = null;
//   remotePeerConnection = null;
//   trace('Closed peer connections');
//   startButton.disabled = false;
//   sendButton.disabled = true;
//   closeButton.disabled = true;
//   dataChannelSend.value = "";
//   dataChannelReceive.value = "";
//   dataChannelSend.disabled = true;
//   dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
// }

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  sendChannel = event.channel;
  sendChannel.onmessage = handleMessage;
  sendChannel.onopen = handleReceiveChannelStateChange;
  sendChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  trace('Received message: ' + event.data);
  receiveTextarea.value = event.data;
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  enableMessageInterface(readyState == "open");
}

function handleReceiveChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  enableMessageInterface(readyState == "open");
}

function enableMessageInterface(shouldEnable) {
  if (shouldEnable) {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

enableMessageInterface(true);

function handleIceCandidate(event, sessionId) {
  if (event.candidate) {
    sendMessage({
      'from': socket.socket.sessionid,
      'to': sessionId,
      'data': {
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate 
      }
    });
  } else {
    console.log(event);
    console.log('End of candidates.');
  }
}

// function handleNegotiation(){
//   console.log('negotiating');
//   doCall();     //it should be the new comer's responsibility to call existing peers.
// }


function doCall() {
  // var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
  // temporary measure to remove Moz* constraints in Chrome
  // if (webrtcDetectedBrowser === 'chrome') {
  //   for (var prop in constraints.mandatory) {
  //     if (prop.indexOf('Moz') !== -1) {
  //       delete constraints.mandatory[prop];
  //     }
  //   }
  // }
  constraints = sdpConstraints;
  console.log('Sending offer to peer, with constraints: \n' +
    '  \'' + JSON.stringify(constraints) + '\'.');
  console.log(sessionID2Peer);
  for (var id in sessionID2Peer){
    (function (sId){
      sessionID2Peer[sId].createOffer(function(sessionDescription){setLocalAndSendMessage(sessionDescription,sessionID2Peer[sId],sId);}, function(argument){console.log("create answer callback");console.log(argument)}, constraints);
    })(id);
  }
}

/*
expecting from server:
{to: sessionID1, from: sessionID2, data: message}
*/
function doAnswer(msg) {
  console.log('Sending answer to peer.');
  var pc = sessionID2Peer[msg.from];
  window.pc = pc;
  (function(pc) {
    var callback = function() {
      for (var i in stack) {
        console.log('adding ice candidate');
        pc.addIceCandidate(stack[i]);
        delete stack[i];
      }
      var successCallback = function(sessionDescription){ 
        console.log('success callback');
        var peer = pc; 
        var to = msg.from; 
        setLocalAndSendMessage(sessionDescription, peer, to);

      }
      pc.createAnswer(successCallback,function(argument){console.log("create answer callback");console.log(argument)}, sdpConstraints);
    }
    pc.setRemoteDescription(new RTCSessionDescription(msg.data), callback);

  })(pc);

}

// function mergeConstraints(cons1, cons2) {
//   var merged = cons1;
//   for (var name in cons2.mandatory) {
//     merged.mandatory[name] = cons2.mandatory[name];
//   }
//   merged.optional.concat(cons2.optional);
//   return merged;
// }

function setLocalAndSendMessage(sessionDescription, peer,to) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  peer.setLocalDescription(sessionDescription);
  sendMessage({'from':socket.socket.sessionid,'to': to, 'data': sessionDescription });
}

function requestTurn() {
  var turnExists = false;
  for (var i in pc_config.iceServers) {
    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    // console.log('Getting TURN server from ', turn_url);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    // xhr.onreadystatechange = function(){
    //   if (xhr.readyState === 4 && xhr.status === 200) {
    //     // var turnServer = JSON.parse(xhr.responseText);
    //     console.log('Got TURN server: ', turnServer);

    //   }
    // };
    pc_config.iceServers.push({
      'url': 'turn:' + turnServer.turn,
      'username': turnServer.username,
      'credential': turnServer.password
    });
    turnReady = true;
    // xhr.open('GET', turn_url, true);
    // xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  // reattachMediaStream(miniVideo, localVideo);
  var container = document.createElement("div");
  container.setAttribute("id", "remoteVidContainer"+peersNum);
  document.body.appendChild(container);
  var remoteVideo = document.createElement("video");
  container.appendChild(remoteVideo);
  remoteVideo.setAttribute("id","remote"+peersNum);
  remoteVideo.setAttribute("autoplay", "");
  peersNum++;
  attachMediaStream(remoteVideo, event.stream);
//  waitForRemoteVideo();
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  // isAudioMuted = false;
  // isVideoMuted = false;
  pc.close();
  pc = null;
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

