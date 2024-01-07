import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeAll,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { handleNewOwner } from "../src/ensRegistry";
import {
  handleNameRegistered,
  handleNameRegisteredByController,
} from "../src/ethRegistrar";
import { NameRegistered } from "../src/types/BaseRegistrar/BaseRegistrar";
import { NewOwner } from "../src/types/ENSRegistry/EnsRegistry";
import { NameRegistered as NameRegisteredByController } from "../src/types/EthRegistrarController/EthRegistrarController";
import { Registration } from "../src/types/schema";

const ETH_NAMEHASH =
  "0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae";

const DEFAULT_OWNER = "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7";

const createNameRegisteredByControllerEvent = (
  name: string,
  label: string,
  owner: string,
  expires: string
): NameRegisteredByController => {
  let mockEvent = newMockEvent();
  let nameRegisteredByControllerEvent = new NameRegisteredByController(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt
  );

  nameRegisteredByControllerEvent.parameters = new Array();
  let nameParam = new ethereum.EventParam(
    "name",
    ethereum.Value.fromString(name)
  );
  let labelParam = new ethereum.EventParam(
    "label",
    ethereum.Value.fromBytes(Bytes.fromHexString(label))
  );
  let ownerParam = new ethereum.EventParam(
    "owner",
    ethereum.Value.fromAddress(Address.fromString(owner))
  );
  let baseCostParam = new ethereum.EventParam(
    "baseCost",
    ethereum.Value.fromSignedBigInt(BigInt.fromI32(0))
  );
  let premiumParam = new ethereum.EventParam(
    "premium",
    ethereum.Value.fromSignedBigInt(BigInt.fromI32(0))
  );
  let expiresParam = new ethereum.EventParam(
    "expires",
    ethereum.Value.fromSignedBigInt(BigInt.fromString(expires))
  );
  nameRegisteredByControllerEvent.parameters.push(nameParam);
  nameRegisteredByControllerEvent.parameters.push(labelParam);
  nameRegisteredByControllerEvent.parameters.push(ownerParam);
  nameRegisteredByControllerEvent.parameters.push(baseCostParam);
  nameRegisteredByControllerEvent.parameters.push(premiumParam);
  nameRegisteredByControllerEvent.parameters.push(expiresParam);

  return nameRegisteredByControllerEvent;
};

const createNewOwnerEvent = (
  node: string,
  label: string,
  owner: string
): NewOwner => {
  let mockEvent = newMockEvent();
  let newNewOwnerEvent = new NewOwner(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt
  );

  newNewOwnerEvent.parameters = new Array();
  let nodeParam = new ethereum.EventParam(
    "node",
    ethereum.Value.fromBytes(Bytes.fromHexString(node))
  );
  let labelParam = new ethereum.EventParam(
    "label",
    ethereum.Value.fromBytes(Bytes.fromHexString(label))
  );
  let ownerParam = new ethereum.EventParam(
    "owner",
    ethereum.Value.fromAddress(Address.fromString(owner))
  );
  newNewOwnerEvent.parameters.push(nodeParam);
  newNewOwnerEvent.parameters.push(labelParam);
  newNewOwnerEvent.parameters.push(ownerParam);
  return newNewOwnerEvent;
};

const createNameRegisteredEvent = (
  id: string,
  owner: string,
  expires: string
): NameRegistered => {
  let mockEvent = newMockEvent();
  let newNameRegisteredEvent = new NameRegistered(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt
  );
  newNameRegisteredEvent.parameters = new Array();
  let idParam = new ethereum.EventParam(
    "id",
    ethereum.Value.fromSignedBigInt(BigInt.fromString(id))
  );
  let ownerParam = new ethereum.EventParam(
    "owner",
    ethereum.Value.fromAddress(Address.fromString(owner))
  );
  let expiresParam = new ethereum.EventParam(
    "expires",
    ethereum.Value.fromSignedBigInt(BigInt.fromString(expires))
  );
  newNameRegisteredEvent.parameters.push(idParam);
  newNameRegisteredEvent.parameters.push(ownerParam);
  newNameRegisteredEvent.parameters.push(expiresParam);
  return newNameRegisteredEvent;
};

beforeAll(() => {
  const ethLabelhash =
    "0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0";
  const emptyNode =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const newNewOwnerEvent = createNewOwnerEvent(
    emptyNode,
    ethLabelhash,
    DEFAULT_OWNER
  );
  handleNewOwner(newNewOwnerEvent);
});

const checkNullLabelName = (
  labelhash: string,
  labelhashAsInt: string,
  label: string
): void => {
  const newNewOwnerEvent = createNewOwnerEvent(
    ETH_NAMEHASH,
    labelhash,
    DEFAULT_OWNER
  );
  handleNewOwner(newNewOwnerEvent);

  let newRegistrationEvent = createNameRegisteredEvent(
    labelhashAsInt,
    DEFAULT_OWNER,
    "1610000000"
  );
  handleNameRegistered(newRegistrationEvent);

  let fetchedRegistration = Registration.load(labelhash)!;

  // set labelName to null because handleNameRegistered sets it to a mocked value of "default"
  // which comes from ens.nameByHash()
  fetchedRegistration.labelName = null;
  fetchedRegistration.save();

  const nameRegisteredByControllerEvent = createNameRegisteredByControllerEvent(
    label,
    labelhash,
    DEFAULT_OWNER,
    "1610000000"
  );
  handleNameRegisteredByController(nameRegisteredByControllerEvent);

  fetchedRegistration = Registration.load(labelhash)!;

  assert.assertNull(fetchedRegistration.labelName);
};

test("does not assign label name to null byte label", () => {
  const labelhash =
    "0x465b93df44674596a1f5cd92ec83053bb8a78f6083e1752b3162c739bba1f9ed";
  const labelhashAsInt =
    "31823703059708284547668674100687316300171847632515296374731848165239501748717";
  const label = "default\0";

  checkNullLabelName(labelhash, labelhashAsInt, label);
});

test("does not assign label name to label with '.' separator", () => {
  const labelhash =
    "0xf8a2e15376341ae37c90b754e5ef3f1e43d1d136a5c7ba6b34c50b466848dfbc";
  const labelhashAsInt =
    "112461370816196049012812662280597321405198137204162513382374556989424524648380";
  const label = "test.123";

  checkNullLabelName(labelhash, labelhashAsInt, label);
});

test("does not assign label name to label with '[' char", () => {
  const labelhash =
    "0x6d2df8d29c51e5e79bce0067df6a093fd7e535f1fe0a509ead1eb5a2171640c9";
  const labelhashAsInt =
    "49383325924636276199200854251362239534766035480602437112552046254651845525705";
  const label =
    "[41ff1915eef2bf5841388d748bfcd23bd49ff5521ca4200c20bc0978b136c3cb";

  checkNullLabelName(labelhash, labelhashAsInt, label);
});

test("does not assign label name to label with ']' char", () => {
  const labelhash =
    "0xb9cf267ed9b0cb8caf44655901be5b66f2e6bbedd8dc1436fba973f7a824db58";
  const labelhashAsInt =
    "84043880016553362091807057514212448616446700818045523307434280128309910362968";
  const label =
    "41ff1915eef2bf5841388d748bfcd23bd49ff5521ca4200c20bc0978b136c3cb]";

  checkNullLabelName(labelhash, labelhashAsInt, label);
});

test("does not assign label name to label that uses unnormalised label notation", () => {
  const labelhash =
    "0x162894963b59f9b7e47a34709830c0211a6ba5f7de3973839f3ee7002e0c8434";
  const labelhashAsInt =
    "10022582060124759960163130513734713560279061696053801337665848910969813369908";
  const label =
    "[41ff1915eef2bf5841388d748bfcd23bd49ff5521ca4200c20bc0978b136c3cb]";

  checkNullLabelName(labelhash, labelhashAsInt, label);
});

test("does assign normal label", () => {
  const labelhash =
    "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658";
  const labelhashAsInt =
    "70622639689279718371527342103894932928233838121221666359043189029713682937432";
  const label = "test";

  const newNewOwnerEvent = createNewOwnerEvent(
    ETH_NAMEHASH,
    labelhash,
    DEFAULT_OWNER
  );
  handleNewOwner(newNewOwnerEvent);

  let newRegistrationEvent = createNameRegisteredEvent(
    labelhashAsInt,
    DEFAULT_OWNER,
    "1610000000"
  );
  handleNameRegistered(newRegistrationEvent);

  let fetchedRegistration = Registration.load(labelhash)!;

  fetchedRegistration.labelName = "eth";
  fetchedRegistration.save();

  const nameRegisteredByControllerEvent = createNameRegisteredByControllerEvent(
    label,
    labelhash,
    DEFAULT_OWNER,
    "1610000000"
  );
  handleNameRegisteredByController(nameRegisteredByControllerEvent);

  fetchedRegistration = Registration.load(labelhash)!;

  assert.assertTrue(fetchedRegistration.labelName == label);
});
