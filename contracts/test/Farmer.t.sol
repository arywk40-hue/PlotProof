// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Farmer} from "../src/Farmer.sol";

contract FarmerTest is Test {
    Farmer farmer;

    address user1 = address(0x1);
    address user2 = address(0x2);

    bytes32 photoHash = keccak256("my-test-photo");

    // Fake IPFS CID for testing
    string ipfsCID = "QmTestPhotoCID123";

    function setUp() public {
        farmer = new Farmer();
    }

    // Test 1: Submit a plot successfully
    function testSubmitPlot() public {
        vm.prank(user1);

        farmer.submitPlot(photoHash, 31000000, 77000000, ipfsCID);

        (address submitter, int256 lat, int256 lon, string memory storedCID, uint256 timestamp, bool exists) =
            farmer.getPlot(photoHash);

        assertEq(submitter, user1);
        assertEq(lat, 31000000);
        assertEq(lon, 77000000);
        assertEq(storedCID, ipfsCID);
        assertTrue(timestamp > 0);
        assertTrue(exists);
    }

    // Test 2: Reward points increase
    function testRewardPoints() public {
        vm.prank(user1);

        farmer.submitPlot(photoHash, 31000000, 77000000, ipfsCID);

        uint256 points = farmer.rewardpts(user1);

        assertEq(points, 1);
    }

    // Test 3: Cannot submit same photo twice
    function testDuplicatePlotFails() public {
        vm.prank(user1);

        farmer.submitPlot(photoHash, 31000000, 77000000, ipfsCID);

        vm.prank(user2);

        vm.expectRevert("You have already submitted the plot");

        farmer.submitPlot(photoHash, 32000000, 78000000, "QmAnotherCID");
    }
}
