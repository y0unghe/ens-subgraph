// Import types and APIs from graph-ts
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
// Import event types from the registry contract ABI
import {
  FusesSet as FusesSetEvent,
  NameUnwrapped as NameUnwrappedEvent,
  NameWrapped as NameWrappedEvent,
  TransferBatch as TransferBatchEvent,
  TransferSingle as TransferSingleEvent,
} from "./types/NameWrapper/NameWrapper";
// Import entity types generated from the GraphQL schema
import {
  Account,
  FusesSet,
  Name,
  NameTransferred,
  NameUnwrapped,
  NameWrapped,
} from "./types/schema";
import { concat, createEventID, uint256ToByteArray } from "./utils";

function decodeName(buf: Bytes): Array<string> {
  let offset = 0;
  let list = Bytes.fromHexString("");
  let dot = Bytes.fromHexString("2e");
  let len = buf[offset++];
  let hex = buf.toHexString();
  let firstLabel = "";
  if (len === 0) {
    return [firstLabel, "."];
  }

  while (len) {
    let label = hex.slice((offset + 1) * 2, (offset + 1 + len) * 2);
    let labelBytes = Bytes.fromHexString(label);

    if (offset > 1) {
      list = concat(list, dot);
    } else {
      firstLabel = labelBytes.toString();
    }
    list = concat(list, labelBytes);
    offset += len;
    len = buf[offset++];
  }
  return [firstLabel, list.toString()];
}

export function handleNameWrapped(event: NameWrappedEvent): void {
  let decoded = decodeName(event.params.name);
  let label = decoded[0];
  let nameStr = decoded[1];
  let node = event.params.node;
  let fuses = event.params.fuses;
  let blockNumber = event.block.number.toI32();
  let transactionID = event.transaction.hash;
  let owner = Account.load(event.params.owner.toHex())!;
  let name = Name.load(node.toHex())!;

  if (!name.labelName) {
    name.labelName = label;
    name.name = nameStr;
  }
  name.ownershipLevel = "NAMEWRAPPER";
  name.owner = owner.id;
  name.fuses = fuses;
  name.save();

  let nameWrappedEvent = new NameWrapped(createEventID(event));
  nameWrappedEvent.name = name.id;
  nameWrappedEvent.fuses = fuses;
  nameWrappedEvent.owner = owner.id;
  nameWrappedEvent.blockNumber = blockNumber;
  nameWrappedEvent.transactionID = transactionID;
  nameWrappedEvent.save();
}

function getOwnershipLevel(name: Name): string {
  if (name.name) {
    let labels = name.name!.split(".");
    if (labels.length === 2 && labels[1] === "eth") {
      return "REGISTRAR";
    }
  }
  return "REGISTRY";
}

export function handleNameUnwrapped(event: NameUnwrappedEvent): void {
  let node = event.params.node;
  let blockNumber = event.block.number.toI32();
  let transactionID = event.transaction.hash;
  let owner = Account.load(event.params.owner.toHex())!;
  let name = Name.load(node.toHex())!;
  name.owner = owner.id;
  name.fuses = null;

  name.ownershipLevel = getOwnershipLevel(name);
  name.save();

  let nameUnwrappedEvent = new NameUnwrapped(createEventID(event));
  nameUnwrappedEvent.name = name.id;
  nameUnwrappedEvent.owner = owner.id;
  nameUnwrappedEvent.blockNumber = blockNumber;
  nameUnwrappedEvent.transactionID = transactionID;
  nameUnwrappedEvent.save();
}

export function handleFusesSet(event: FusesSetEvent): void {
  let node = event.params.node;
  let fuses = event.params.fuses;
  let blockNumber = event.block.number.toI32();
  let transactionID = event.transaction.hash;
  let name = Name.load(node.toHex())!;
  name.fuses = fuses;
  name.save();
  let fusesBurnedEvent = new FusesSet(createEventID(event));
  fusesBurnedEvent.name = name.id;
  fusesBurnedEvent.fuses = fuses;
  fusesBurnedEvent.blockNumber = blockNumber;
  fusesBurnedEvent.transactionID = transactionID;
  fusesBurnedEvent.save();
}

function handleTransfer<T extends ethereum.Event>(
  to: Address,
  id: BigInt,
  event: T
): void {
  let account = new Account(to.toHex());
  account.save();

  let nameAsBytes = uint256ToByteArray(id);
  let name = Name.load(nameAsBytes.toHex());
  if (name == null) return;

  name.owner = account.id;
  name.save();

  let transferEvent = new NameTransferred(createEventID(event));
  transferEvent.name = nameAsBytes.toHex();
  transferEvent.blockNumber = event.block.number.toI32();
  transferEvent.transactionID = event.transaction.hash;
  transferEvent.newOwner = account.id;
  transferEvent.save();
}

export function handleSingleTransfer(event: TransferSingleEvent): void {
  handleTransfer(event.params.to, event.params.id, event);
}

export function handleBatchTransfer(event: TransferBatchEvent): void {
  const to = event.params.to;
  for (let i = 0; i < event.params.ids.length; i += 1) {
    handleTransfer(to, event.params.ids[i], event);
  }
}
