// Import types and APIs from graph-ts
import { BigInt, ByteArray, Bytes, crypto, log } from "@graphprotocol/graph-ts";

import {
  byteArrayFromHex,
  concat,
  createEventID,
  uint256ToByteArray,
} from "./utils";

// Import event types from the registry contract ABI
import {
  NameRenewed as NameRenewedEvent,
  Transfer as TransferEvent,
} from "./types/BaseRegistrar/BaseRegistrar";

import { NameRegistered as ControllerNameRegisteredEventOld } from "./types/EthRegistrarControllerOld/EthRegistrarControllerOld";

import {
  NameRegistered as ControllerNameRegisteredEvent,
  NameRenewed as ControllerNameRenewedEvent,
} from "./types/EthRegistrarController/EthRegistrarController";

// Import entity types generated from the GraphQL schema
import {
  Account,
  Name,
  NameRegistered,
  NameRenewed,
  NameTransferred,
} from "./types/schema";

var rootNode: ByteArray = byteArrayFromHex(
  "93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae"
);

const normaliseId = (label: ByteArray): string =>
  crypto.keccak256(concat(rootNode, label)).toHexString();

function handleNameRegistered<T>(event: T): void {
  if (event instanceof ControllerNameRegisteredEvent) {
    event = changetype<ControllerNameRegisteredEvent>(event);
  } else {
    event = changetype<ControllerNameRegisteredEventOld>(event);
  }

  let account = new Account(event.params.owner.toHex());
  account.save();

  let label = event.params.label;
  let name = Name.load(normaliseId(label))!;
  name.expiryDate = event.params.expires;
  name.labelName = event.params.name;
  if (event instanceof ControllerNameRegisteredEvent) {
    name.ownershipLevel = "NAMEWRAPPER";
    name.owner = account.id;
  } else {
    name.ownershipLevel = "REGISTRAR";
    name.registrant = account.id;
  }
  name.save();

  let nameEvent = new NameRegistered(createEventID(event));
  nameEvent.name = name.id;
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.expiryDate = event.params.expires;
  if (event instanceof ControllerNameRegisteredEvent) {
    nameEvent.owner = account.id;
    nameEvent.baseCost = event.params.baseCost;
    nameEvent.premium = event.params.premium;
  } else {
    nameEvent.registrant = account.id;
    nameEvent.baseCost = event.params.cost;
    nameEvent.premium = BigInt.fromI32(0);
  }
  nameEvent.save();
}

export function handleNameRegisteredByControllerOld(
  event: ControllerNameRegisteredEventOld
): void {
  setNamePreimage(event.params.name, event.params.label, event.params.cost);
  handleNameRegistered(event);
}

export function handleNameRegisteredByController(
  event: ControllerNameRegisteredEvent
): void {
  setNamePreimage(
    event.params.name,
    event.params.label,
    event.params.baseCost.plus(event.params.premium)
  );
  handleNameRegistered(event);
}

export function handleNameRenewedByController(
  event: ControllerNameRenewedEvent
): void {
  setNamePreimage(event.params.name, event.params.label, event.params.cost);
}

function setNamePreimage(nameStr: string, label: Bytes, cost: BigInt): void {
  const labelHash = crypto.keccak256(ByteArray.fromUTF8(nameStr));
  if (!labelHash.equals(label)) {
    log.warning("Expected '{}' to hash to {}, but got {} instead. Skipping.", [
      nameStr,
      labelHash.toHex(),
      label.toHex(),
    ]);
    return;
  }

  if (nameStr.indexOf(".") !== -1) {
    log.warning("Invalid label '{}'. Skipping.", [nameStr]);
    return;
  }

  let name = Name.load(crypto.keccak256(concat(rootNode, label)).toHex())!;
  if (name.labelName !== nameStr) {
    name.labelName = nameStr;
    name.name = nameStr + ".eth";
    name.cost = cost;
    name.save();
  }
}

export function handleNameRenewed(event: NameRenewedEvent): void {
  let label = uint256ToByteArray(event.params.id);
  let name = Name.load(normaliseId(label))!;
  name.expiryDate = event.params.expires;
  name.save();

  let nameEvent = new NameRenewed(createEventID(event));
  nameEvent.name = name.id;
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.expiryDate = event.params.expires;
  nameEvent.save();
}

export function handleNameTransferred(event: TransferEvent): void {
  let account = new Account(event.params.to.toHex());
  account.save();

  let label = uint256ToByteArray(event.params.tokenId);
  let name = Name.load(normaliseId(label));
  if (name == null) return;

  name.registrant = account.id;
  name.save();

  let transferEvent = new NameTransferred(createEventID(event));
  transferEvent.name = name.id;
  transferEvent.blockNumber = event.block.number.toI32();
  transferEvent.transactionID = event.transaction.hash;
  transferEvent.newOwner = account.id;
  transferEvent.save();
}
