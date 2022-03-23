let net = require("net");
let handler = require('./PeerHandler'),
  singleton = require("./Singleton");

let directoryNames = process.cwd().split('\\');
// take the last element of the path c:\abc\aaa\peer1-2 would be peer1-2
let directoryName = directoryNames[directoryNames.length-1];
let dirs = directoryName.split('/');
let senderName = dirs[dirs.length-1]

//KADpeer [-p <peerIP>:<port></port>
let serverIPandPort;
let PORT = undefined;
let IP = undefined;

try{
  serverIPandPort = process.argv[3].split(":");
  PORT = serverIPandPort[1];
  IP = serverIPandPort[0];
}catch{

}

singleton.init();

if(PORT !== undefined && PORT !== undefined){
    //join on server
    handler.handleServerJoining(IP,PORT);
}

//create server
const peerRecv = net.createServer();
//start listening 
peerRecv.listen(0, "127.0.0.1", function (){
  //init server ip and host
  handler.init(peerRecv.address().address,peerRecv.address().port, senderName);
  console.log(`This peer address is ${peerRecv.address().address}:${peerRecv.address().port} located at ${senderName} [${singleton.getPeerID(peerRecv.address().address, peerRecv.address().port)}]`);
});

peerRecv.on('connection', function(sock) {
  //handle response to peer joining
  handler.handlePeersJoining(sock);
});

peerRecv.on('data', (data) =>  {
  //response to peer sending hello packet
  handler.handleHelloPacket(data);
});

peerRecv.on('exit', function () {
  //clear
});

