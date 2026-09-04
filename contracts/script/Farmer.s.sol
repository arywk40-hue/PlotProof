// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Farmer} from "../src/Farmer.sol";

contract DeployFarmer is Script {
    function run() external returns (Farmer) {
        vm.startBroadcast();

        Farmer farmer = new Farmer();

        vm.stopBroadcast();

        return farmer;
    }
}
