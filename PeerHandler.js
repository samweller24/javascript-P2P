let net = require("net");
var KADResponse = require("./KADResponse"),
  singleton = require("./Singleton");


var DHTTable={};
let MAX_TABLE_SIZE=160;
let port;
let host;
let sendername;


module.exports = {
  init: function (IP, PORT, senderName){
    port = PORT;
    host = IP;
    sendername = senderName;
  },
  handlePeersJoining: function (sock) {  
    handleClientRequests(sock); //handle peer joining

  },
  handleServerJoining: function (IP, PORT){
    //create and connect socket
    let peerSender = net.Socket();
    peerSender.connect(PORT, IP, function () {
      //push server peer to DHT
      let peer = [IP,  PORT, singleton.getPeerID(IP, PORT)];
      pushBucket(DHTTable, peer);
    });

    // client received data
    peerSender.on('data', (data) => {
      handleServerJoining(data, peerSender.remotePort);
    });
  },
  handleHelloPacket: function (data){
    handleHelloPacketData(data);
  },
  handlePushBucket: function (peer){
    pushBucket(DHTTable, peer);
  }
};

//handle response to joining peer
function handleClientRequests(sock) {
  //get number of peers on current table
  let numPeers = Object.keys(DHTTable).length;
  //init response packet
  KADResponse.init(numPeers, sendername, DHTTable, 1);

  //write response and end socket
  sock.write(KADResponse.getBytePacket());

  //push conneting peer info
  let peer = [sock.address().address, sock.remotePort + 1, singleton.getPeerID(sock.address().address, sock.address().port)];
  //push peer to table
  pushBucket(DHTTable,peer);

  //console connection log
  console.log(`Connected from peer 127.0.0.1:${sock.remotePort+1}`);
}

//handle peer joining on server
function handleServerJoining(data, sPORT){

  //response data
  let response = Buffer.from(data);
  //get values from response

  //get version, if 7
  let version = parseBitPacket(response, 0, 4);
  if(version === 7){
    //values from packet
    let numberOfPeers = parseBitPacket(response,12, 8);
    let lengthOfName = parseBitPacket(response,20, 12);
    //sender name
    let senderName = bytesToString(response.slice(4, 4+lengthOfName));
    //connect message
    console.log(`Connected to ${senderName}:${sPORT} at timestamp: ${singleton.getTimestamp()}`);
    //peer table
    let peerTableResponse = response.slice(4+lengthOfName);
    //index for string table
    let stringPeerTable = [];
    if (numberOfPeers != 0){
      //pull IP and PORT out of payload
      for(let i = 0; i < numberOfPeers; i++){
        let IPtable = [];
        for(let j = 0; j < 4; j++){
          let ipFrag = parseBitPacket(peerTableResponse, (i*48) + (8*j),8);
          IPtable.push(ipFrag);
        }
        let fullIP = IPtable.join('.');
        let portNum = parseBitPacket(peerTableResponse,(i*48)+32,16);
        stringPeerTable.push([fullIP, portNum]);
      }
      //print message
      console.log(`Recived Welcome message from ${senderName} \n along with DHT: `);
      for(let i = 0; i < numberOfPeers; i++){
        let IPtable = [];
        for(let j = 0; j < 4; j++){
          let ipFrag = parseBitPacket(peerTableResponse, (i*48) + (8*j),8);
          IPtable.push(ipFrag);
        }
        let fullIP = IPtable.join('.');
        let portNum = parseBitPacket(peerTableResponse,(i*48)+32,16);
        console.log(`[${fullIP},${portNum},${singleton.getPeerID(fullIP,portNum)}]\n`)
      }
    } else{
      //numPeers == 0
      //print  message
      console.log(`Recived Welcome message from ${senderName} \n along with DHT: [] `);
    }

    //call refresh buckets
    console.log('Refresh k-Bucket operation is performed.')
    refreshBuckets(DHTTable, stringPeerTable);
    //once refresh has been called, print current DHTTable and send hello
    printDHTTable()
    sendHello(DHTTable);
  }
}

function handleHelloPacketData(data){
    //response data
    let response = Buffer.from(data);

    //get version, if 7
    let version = parseBitPacket(response, 0, 4);
    //values from packet
    let msg = parseBitPacket(response, 4, 8);
    let numPeers = parseBitPacket(response,12,8);

    if(version === 7 && msg === 2){ 
      //get required values from response
      let lengthOfName = parseBitPacket(response, 20, 12);
      //peer table
      let peerTableResponse = response.slice(4 + lengthOfName);

      //create peer table
      let stringPeerTable = [];
      //pull IP and PORT out of payload
      for(let i = 0; i < numPeers; i++){
        let IPtable = [];
        for(let j = 0; j < 4; j++){
          let ipFrag = parseBitPacket(peerTableResponse, (i*48) + (8*j),8);
          IPtable.push(ipFrag);
        }
        let fullIP = IPtable.join('.');
        let portNum = parseBitPacket(peerTableResponse,(i*48)+32,16);
        // if(fullIP != host && portNum != port ){
        //   stringPeerTable.push([fullIP, portNum]);
        // }
        stringPeerTable.push([fullIP, portNum]);
      }
      //call refresh buckets with new peer table
      refreshBuckets(DHTTable, stringPeerTable);
    }
}

//push bucket function
function pushBucket(DHTTable, peer){
  //get info of server peer and client peer
  let clientInfo = peer;
  let serverInfo = [host, port, singleton.getPeerID(host, port)];

  //get binary representation of ids
  let binaryClientId = singleton.Hex2Bin(clientInfo[2]);
  let binaryServerId = singleton.Hex2Bin(serverInfo[2]);

  //define bits shared for index, and calculate left-most shared bits using for
  let bitsShared = 0;
  for(let i = 0; i < 20; i++){
    if(binaryClientId[i] == binaryServerId[i]){
      bitsShared++;
    }
  }

  //once index if determined, check if index exists in table
  if(bitsShared in DHTTable){
    //if exists, get current value
    let Ninfo = DHTTable[bitsShared].split(',')
    let N = singleton.Hex2Bin(singleton.getPeerID(Ninfo[0], Ninfo[1]));
    //get distances from server
    let distanceToN = singleton.XORing(binaryServerId, N);
    let distanceToP = singleton.XORing(binaryServerId, binaryClientId);
    //if client is closer, add in index, else dont change
    if(distanceToN > distanceToP){
      DHTTable[bitsShared] = `${clientInfo[0]},${clientInfo[1]}`;
    }
  }else{
    //if no value, add as new value
    DHTTable[bitsShared] = `${clientInfo[0]},${clientInfo[1]}`;
  } 
};

//refresh bucket function
function refreshBuckets(DHTTable, peerTable){
  if(peerTable.length >= 1){
    //iterate through peer table
    for(let i = 0; i < peerTable.length; i++){
      //get values for each peer
      let peer = [peerTable[i][0], peerTable[i][1], singleton.getPeerID(peerTable[i][0],peerTable[i][1])];
      //push to DHTTable
      pushBucket(DHTTable, peer);
    }
  }
};

function sendHello(DHTTable){
  //iterate through each peer 
  for (let key in DHTTable) {
    //get DHTtable info
    let info = DHTTable[key].split(',')
    let peerSender = new net.Socket();
    //connect to each peer in DHTTable
    peerSender.connect(info[1], info[0], function () {
    });
    //get number of peers on current table
    let numPeers = Object.keys(DHTTable).length;
    //init hello packet with msg=2
    KADResponse.init(numPeers, sendername, DHTTable, 2);
    //send to server peers
    peerSender.write(KADResponse.getBytePacket());
    peerSender.end();
  }
  console.log('Hello Packet has been sent.')
};

function printDHTTable(){
  console.log('My DHT:');
  for (let key in DHTTable) {
    let info = DHTTable[key].split(',')
    console.log(`[${info[0]},${info[1]},${singleton.getPeerID(info[0],info[1])}]`);
  }
}

function handleClientLeaving(sock) {
  console.log(nickNames[sock.id] + " closed the connection");

}

function bytesToString(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}

function bytes2number(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result ^= array[array.length - i - 1] << (8 * i);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}
// Prints the entire packet in bits format
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}
