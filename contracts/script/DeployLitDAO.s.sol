// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DAORegistry} from "../src/DAORegistry.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {GovernorDeployer} from "../src/GovernorDeployer.sol";
import {GovernorFactory} from "../src/GovernorFactory.sol";
import {FaucetFactory} from "../src/FaucetFactory.sol";
import {DAOToken} from "../src/DAOToken.sol";
import {DAOFaucet} from "../src/DAOFaucet.sol";

contract DeployLitDAO is Script {
    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;
        console.log("--------------------------------------------------");
        console.log("Agora Deployment to liteforge LiteForge (Chain ID: 4441)");
        console.log("Deployer address:", deployer);
        console.log("--------------------------------------------------");

        // 1. Deploy DAORegistry
        DAORegistry registry = new DAORegistry(deployer);
        console.log("1. DAORegistry deployed at:", address(registry));

        // 2. Deploy TokenFactory
        TokenFactory tokenFactory = new TokenFactory();
        console.log("2. TokenFactory deployed at:", address(tokenFactory));

        // 3. Deploy GovernorDeployer
        GovernorDeployer govDeployer = new GovernorDeployer();
        console.log("3. GovernorDeployer deployed at:", address(govDeployer));

        // 4. Deploy GovernorFactory wired to registry and deployer
        GovernorFactory governorFactory = new GovernorFactory(
            address(registry),
            address(govDeployer)
        );
        console.log("4. GovernorFactory deployed at:", address(governorFactory));

        // 5. Deploy FaucetFactory
        FaucetFactory faucetFactory = new FaucetFactory();
        console.log("5. FaucetFactory deployed at:", address(faucetFactory));

        // 6. Authorize GovernorFactory in DAORegistry
        registry.setFactoryAuthorized(address(governorFactory), true);
        console.log("6. GovernorFactory authorized in DAORegistry");

        // 7. Deploy Alpha Demo DAO on liteforge
        // 7a. Deploy Demo Governance Token
        address demoTokenAddr = tokenFactory.createToken(
            "LitForge Governance Token",
            "LFT",
            1_000_000 ether,
            deployer
        );
        DAOToken demoToken = DAOToken(demoTokenAddr);
        console.log("7a. Demo Token (LFT) deployed at:", demoTokenAddr);

        // 7b. Deploy Demo Governor & Timelock via GovernorFactory
        GovernorFactory.GovernorParams memory params = GovernorFactory.GovernorParams({
            name: "LitForge Alpha DAO",
            token: demoTokenAddr,
            votingDelay: 60, // 60 seconds
            votingPeriod: 3600, // 1 hour
            proposalThreshold: 0,
            quorumFraction: 4, // 4%
            timelockMinDelay: 60 // 60 seconds
        });
        (address demoGovAddr, address demoTimelockAddr) = governorFactory.createGovernor(params);
        console.log("7b. Demo Governor deployed at:", demoGovAddr);
        console.log("    Demo Timelock deployed at:", demoTimelockAddr);

        // 7c. Deploy Demo Faucet in MINT mode (100 tokens per claim, 5-minute cooldown)
        address demoFaucetAddr = faucetFactory.createFaucet(
            demoTokenAddr,
            100 ether,
            300,
            DAOFaucet.FaucetMode.MINT
        );
        console.log("7c. Demo Faucet deployed at:", demoFaucetAddr);

        // 7d. Grant MINTER_ROLE on demo token to the demo faucet
        demoToken.grantRole(demoToken.MINTER_ROLE(), demoFaucetAddr);
        console.log("7d. Granted MINTER_ROLE to Demo Faucet");

        vm.stopBroadcast();

        // 8. Serialize and write deployments to deployments/liteforge.json
        string memory root = "deployment";
        vm.serializeAddress(root, "daoRegistry", address(registry));
        vm.serializeAddress(root, "tokenFactory", address(tokenFactory));
        vm.serializeAddress(root, "governorDeployer", address(govDeployer));
        vm.serializeAddress(root, "governorFactory", address(governorFactory));
        vm.serializeAddress(root, "faucetFactory", address(faucetFactory));
        vm.serializeAddress(root, "demoToken", demoTokenAddr);
        vm.serializeAddress(root, "demoGovernor", demoGovAddr);
        vm.serializeAddress(root, "demoTimelock", demoTimelockAddr);
        string memory finalJson = vm.serializeAddress(root, "demoFaucet", demoFaucetAddr);

        vm.writeJson(finalJson, "./deployments/liteforge.json");
        console.log("--------------------------------------------------");
        console.log("Deployment manifest saved to contracts/deployments/liteforge.json");
        console.log("--------------------------------------------------");
    }
}
