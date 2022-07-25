// Import types and APIs from graph-ts
import { BigInt, crypto, ens } from "@graphprotocol/graph-ts";

import { concat, createEventID, EMPTY_ADDRESS, ROOT_NODE } from "./utils";

// Import event types from the registry contract ABI
import {
  NewOwner as NewOwnerEvent,
  NewResolver as NewResolverEvent,
  NewTTL as NewTTLEvent,
  Transfer as TransferEvent,
} from "./types/ENSRegistry/EnsRegistry";

// Import entity types generated from the GraphQL schema
import {
  Account,
  Name,
  NewOwner,
  NewResolver,
  NewTTL,
  Resolver,
  Transfer,
} from "./types/schema";

const BIG_INT_ZERO = BigInt.fromI32(0);

function createName(node: string, timestamp: BigInt): Name {
  let domain = new Name(node);
  if (node == ROOT_NODE) {
    domain = new Name(node);
    domain.ownershipLevel = "REGISTRY";
    domain.owner = EMPTY_ADDRESS;
    domain.isMigrated = true;
    domain.createdAt = timestamp;
    domain.subnameCount = 0;
  }
  return domain;
}

function getName(node: string, timestamp: BigInt = BIG_INT_ZERO): Name | null {
  let name = Name.load(node);
  if (name === null && node == ROOT_NODE) {
    return createName(node, timestamp);
  } else {
    return name;
  }
}

function makeSubnode(event: NewOwnerEvent): string {
  return crypto
    .keccak256(concat(event.params.node, event.params.label))
    .toHexString();
}

function recurseNameDelete(name: Name): string | null {
  if (
    (name.resolver == null || name.resolver!.split("-")[0] == EMPTY_ADDRESS) &&
    name.owner == EMPTY_ADDRESS &&
    name.subnameCount == 0
  ) {
    const parentName = Name.load(name.parent!);
    if (parentName != null) {
      parentName.subnameCount = parentName.subnameCount - 1;
      parentName.save();
      return recurseNameDelete(parentName);
    }

    return null;
  }

  return name.id;
}

function saveName(name: Name): void {
  recurseNameDelete(name);
  name.save();
}

// Handler for NewOwner events
function _handleNewOwner(event: NewOwnerEvent, isMigrated: boolean): void {
  let account = new Account(event.params.owner.toHexString());
  account.save();

  let subnode = makeSubnode(event);
  let name = getName(subnode, event.block.timestamp);
  let parent = getName(event.params.node.toHexString());

  if (name === null) {
    name = new Name(subnode);
    name.createdAt = event.block.timestamp;
    name.subnameCount = 0;
    name.ownershipLevel = "REGISTRY";
  }

  if (name.parent === null && parent !== null) {
    parent.subnameCount = parent.subnameCount + 1;
    parent.save();
  }

  if (name.name == null) {
    // Get label and node names
    let label = ens.nameByHash(event.params.label.toHexString());
    if (label != null) {
      name.labelName = label;
    }

    if (label === null) {
      label = "[" + event.params.label.toHexString().slice(2) + "]";
    }
    if (
      event.params.node.toHexString() ==
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      name.name = label;
    } else {
      parent = parent!;
      let parentName = parent.name!;
      if (label && name) {
        name.name = label + "." + parentName;
      }
    }
  }

  name.owner = event.params.owner.toHexString();
  name.parent = event.params.node.toHexString();
  name.labelhash = event.params.label;
  name.isMigrated = isMigrated;
  name.ownershipLevel = "REGISTRY";
  saveName(name);

  let nameEvent = new NewOwner(createEventID(event));
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.parentName = event.params.node.toHexString();
  nameEvent.name = subnode;
  nameEvent.owner = event.params.owner.toHexString();
  nameEvent.save();
}

// Handler for Transfer events
export function handleTransfer(event: TransferEvent): void {
  let node = event.params.node.toHexString();

  let account = new Account(event.params.owner.toHexString());
  account.save();

  // Update the domain owner
  let name = getName(node)!;

  name.owner = event.params.owner.toHexString();
  saveName(name);

  let nameEvent = new Transfer(createEventID(event));
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.name = node;
  nameEvent.owner = event.params.owner.toHexString();
  nameEvent.save();
}

// Handler for NewResolver events
export function handleNewResolver(event: NewResolverEvent): void {
  let id = event.params.resolver
    .toHexString()
    .concat("-")
    .concat(event.params.node.toHexString());

  let node = event.params.node.toHexString();
  let name = getName(node)!;
  name.resolver = id;

  let resolver = Resolver.load(id);
  if (resolver == null) {
    resolver = new Resolver(id);
    resolver.name = event.params.node.toHexString();
    resolver.address = event.params.resolver;
    resolver.save();
  } else {
    name.resolvedAddress = resolver.addr;
  }
  saveName(name);

  let nameEvent = new NewResolver(createEventID(event));
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.name = node;
  nameEvent.resolver = id;
  nameEvent.save();
}

// Handler for NewTTL events
export function handleNewTTL(event: NewTTLEvent): void {
  let node = event.params.node.toHexString();
  let name = getName(node);
  // For the edge case that a domain's owner and resolver are set to empty
  // in the same transaction as setting TTL
  if (name) {
    name.ttl = event.params.ttl;
    name.save();
  }

  let nameEvent = new NewTTL(createEventID(event));
  nameEvent.blockNumber = event.block.number.toI32();
  nameEvent.transactionID = event.transaction.hash;
  nameEvent.name = node;
  nameEvent.ttl = event.params.ttl;
  nameEvent.save();
}

export function handleNewOwner(event: NewOwnerEvent): void {
  _handleNewOwner(event, true);
}

export function handleNewOwnerOldRegistry(event: NewOwnerEvent): void {
  let subnode = makeSubnode(event);
  let name = getName(subnode);

  if (name == null || name.isMigrated == false) {
    _handleNewOwner(event, false);
  }
}

export function handleNewResolverOldRegistry(event: NewResolverEvent): void {
  let node = event.params.node.toHexString();
  let name = getName(node, event.block.timestamp)!;
  if (node == ROOT_NODE || !name.isMigrated) {
    handleNewResolver(event);
  }
}
export function handleNewTTLOldRegistry(event: NewTTLEvent): void {
  let name = getName(event.params.node.toHexString())!;
  if (name.isMigrated == false) {
    handleNewTTL(event);
  }
}

export function handleTransferOldRegistry(event: TransferEvent): void {
  let name = getName(event.params.node.toHexString())!;
  if (name.isMigrated == false) {
    handleTransfer(event);
  }
}
