// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract BadTokenReturnFalse{
        function balanceOf(address) external pure returns (uint256){ return 1_000_000e6;}
    
        function allowance (address,address) external pure returns (uint256){
            return 1_000_00e6;
        }
    

        function transferFrom(address,address,uint256) external pure returns (bool){
            return false;

        }
        
        
    
}
