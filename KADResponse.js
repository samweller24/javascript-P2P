//size of the response packet header:
var HEADER_SIZE = 4;

module.exports = {
  responseHeader: "", //Bitstream of the request packet 
  namePayload: "",
  peerTablePayload: null,
  packet: "",

  init: function (
    numPeers,
    senderName,
    DHTTable,
    msg
  ) {

    //build the header bistream:
    //--------------------------
    this.responseHeader = new Buffer.alloc(HEADER_SIZE);

    //fill out the header array of byte with ITP header fields
    // V
    storeBitPacket(this.responseHeader, 7, 0, 4);
    // Response type
    storeBitPacket(this.responseHeader, msg, 4, 8);
    // sequenceNumber
    storeBitPacket(this.responseHeader, numPeers, 12, 8);
    // timeStamp
    storeBitPacket(this.responseHeader, stringToBytes(senderName).length, 20, 12);

    //fill the payload bitstream:
    //--------------------------
    this.namePayload = new Buffer.alloc(stringToBytes(senderName).length);
    // Name data  
    let nameData = stringToBytes(senderName);
    for (j = 0; j < nameData.length; j++) {
      this.namePayload[j] = nameData[j];
    }

    if(numPeers != 0){
      for (let key in DHTTable) {
        let currentPair = new Buffer.alloc(6);
        let info = DHTTable[key].split(',')
        let ipArray = info[0].split('.'); //IP
        for(let i = 0; i < ipArray.length; i++ ){
          storeBitPacket(currentPair, parseInt(ipArray[i]), (i*8),8);
        }
        storeBitPacket(currentPair,parseInt(info[1]), 32, 16); //PORT
        if(this.peerTablePayload){
          this.peerTablePayload = Buffer.concat([this.peerTablePayload, currentPair]);
        }else{
          this.peerTablePayload = currentPair;
        }
      }
    }else{
      this.peerTablePayload = new Buffer.alloc(0);
    }

    packet = new Buffer.concat([this.responseHeader, this.namePayload, this.peerTablePayload]);

    
  },

  //--------------------------
  //getBytePacket: returns the entire packet in bytes
  //--------------------------
  getBytePacket: function () {
    return packet;
  },
};

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
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

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Not used in this assignment
function setPacketBit(packet, position, value) {
  // let us get the actual byte position and the bit position
  // within this byte
  let bytePosition = Math.floor(position / 8);
  let bitPosition = 7 - (position % 8);
  if (value == 0) {
    packet[bytePosition] &= ~(1 << bitPosition);
  } else {
    packet[bytePosition] |= 1 << bitPosition;
  }
}