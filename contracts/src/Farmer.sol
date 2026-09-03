// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Farmer{

    struct details{
    address sender;
    uint256 timestamp;
   int256 longitudes;
    int256 latitudes;
     string ipfsCID;
    bool exists;
}
mapping(bytes32=> details) public photohash;
mapping(address=>uint256) public rewardpts;
event PlotVerified(
    bytes32 indexed photohash,
    address indexed submitter,
    int256 latitudes,
    int256 longitudes,
     string ipfsCID,
    uint256 timestamp
);
function submitPlot(bytes32 photoHash, int256 lats,int256 longs,string calldata ipfsCID)external{
    require(!photohash[photoHash].exists,"You have already submitted the plot");
    photohash[photoHash]=details({
        sender:msg.sender,
        timestamp:block.timestamp,
        longitudes:longs,
        latitudes:lats,
         ipfsCID: ipfsCID,
        exists:true
    });
    rewardpts[msg.sender]+=1;
    emit PlotVerified(photoHash,msg.sender,lats,longs,ipfsCID,block.timestamp);
}
function getPlot(bytes32 photoHash) external view returns(address submitter,int256 lats,int256 longs,string memory ipfsCID,uint256 timestamp,bool exists){
    details memory p = photohash[photoHash];
    return (p.sender, p.latitudes, p.longitudes, p.ipfsCID,p.timestamp, p.exists);
}
}