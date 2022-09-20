import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ABIChanged as ABIChangedEvent,
  AddrChanged as AddrChangedEvent,
  AddressChanged as AddressChangedEvent,
  AuthorisationChanged as AuthorisationChangedEvent,
  ContenthashChanged as ContenthashChangedEvent,
  InterfaceChanged as InterfaceChangedEvent,
  NameChanged as NameChangedEvent,
  PubkeyChanged as PubkeyChangedEvent, RecordVersionChanged, TextChanged as TextChangedEvent
} from "./types/Resolver/Resolver";
import {
  AbiChanged, Account, AddrChanged, AuthorisationChanged, ContenthashChanged, Domain, InterfaceChanged, MulticoinAddrChanged,
  NameChanged, PubkeyChanged, Resolver, ResolverVersion, TextChanged, VersionChanged
} from './types/schema';

export function handleAddrChanged(event: AddrChangedEvent): void {
  let account = new Account(event.params.a.toHexString())
  account.save()

  let resolver = getOrCreateResolver(event.params.node, event.address)
  resolver.domain = event.params.node.toHexString()
  resolver.address = event.address
  resolver.addr = event.params.a.toHexString()
  resolver.save()

  let domain = Domain.load(event.params.node.toHexString())
  if(domain && domain.resolver == resolver.id) {
    domain.resolvedAddress = event.params.a.toHexString()
    domain.save()
  }

  let resolverVersion = loadResolverVersionFromResolver(resolver)
  resolverVersion.addr = event.params.a.toHexString()
  resolverVersion.save()

  let resolverEvent = new AddrChanged(createEventID(event))
  resolverEvent.resolver = resolver.id
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.addr = event.params.a.toHexString()
  resolverEvent.versionId = resolverVersion.id
  resolverEvent.save()
}

export function handleMulticoinAddrChanged(event: AddressChangedEvent): void {
  let resolver = getOrCreateResolver(event.params.node, event.address)
  let resolverVersion = loadResolverVersionFromResolver(resolver)

  let coinType = event.params.coinType
  let coinTypes = resolver.coinTypes
  if (coinTypes == null) {
    coinTypes = [coinType];
  } else {
    if (!coinTypes.includes(coinType)) {
      coinTypes.push(coinType);
    }
  }
  resolver.coinTypes = coinTypes;
  resolverVersion.coinTypes = coinTypes;
  resolver.save();
  resolverVersion.save();

  let resolverEvent = new MulticoinAddrChanged(createEventID(event))
  resolverEvent.resolver = resolver.id
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.coinType = coinType
  resolverEvent.addr = event.params.newAddress
  resolverEvent.save()
}

export function handleNameChanged(event: NameChangedEvent): void {
  if(event.params.name.indexOf("\u0000") != -1) return;
  
  let resolverEvent = new NameChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.name = event.params.name
  resolverEvent.versionId = makeVersionIdFromResolverId(resolverEvent.resolver)
  resolverEvent.save()
}

export function handleABIChanged(event: ABIChangedEvent): void {
  let resolverEvent = new AbiChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.contentType = event.params.contentType
  resolverEvent.versionId = makeVersionIdFromResolverId(resolverEvent.resolver)
  resolverEvent.save()
}

export function handlePubkeyChanged(event: PubkeyChangedEvent): void {
  let resolverEvent = new PubkeyChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.x = event.params.x
  resolverEvent.y = event.params.y
  resolverEvent.versionId = makeVersionIdFromResolverId(resolverEvent.resolver)
  resolverEvent.save()
}

export function handleTextChanged(event: TextChangedEvent): void {
  let resolver = getOrCreateResolver(event.params.node, event.address)
  let resolverVersion = loadResolverVersionFromResolver(resolver)

  let key = event.params.key;
  let texts = resolver.texts
  if (texts == null) {
    texts = [key];
  } else {
    if (!texts.includes(key)) {
      texts.push(key);
    }
  }
  resolver.texts = texts;
  resolverVersion.texts = texts;
  resolver.save();
  resolverVersion.save();

  let resolverEvent = new TextChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.key = event.params.key
  resolverEvent.versionId = resolverVersion.id
  resolverEvent.save()
}

export function handleContentHashChanged(event: ContenthashChangedEvent): void {
  let resolver = getOrCreateResolver(event.params.node, event.address)
  let resolverVersion = loadResolverVersionFromResolver(resolver)
  resolver.contentHash = event.params.hash
  resolverVersion.contentHash = event.params.hash
  resolver.save()
  resolverVersion.save()
  
  let resolverEvent = new ContenthashChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.hash = event.params.hash
  resolverEvent.versionId = resolverVersion.id
  resolverEvent.save()
}

export function handleInterfaceChanged(event: InterfaceChangedEvent): void {
  let resolverEvent = new InterfaceChanged(createEventID(event))
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.interfaceID = event.params.interfaceID
  resolverEvent.implementer = event.params.implementer
  resolverEvent.versionId = makeVersionIdFromResolverId(resolverEvent.resolver)
  resolverEvent.save()
}

export function handleAuthorisationChanged(event: AuthorisationChangedEvent): void {
  let resolverEvent = new AuthorisationChanged(createEventID(event))
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.owner = event.params.owner
  resolverEvent.target = event.params.target
  resolverEvent.isAuthorized = event.params.isAuthorised
  resolverEvent.save()
}

export function handleVersionChanged(event: RecordVersionChanged): void {
  let resolverEvent = new VersionChanged(createEventID(event))
  resolverEvent.blockNumber = event.block.number.toI32()
  resolverEvent.transactionID = event.transaction.hash
  resolverEvent.resolver = createResolverID(event.params.node, event.address)
  resolverEvent.version = event.params.newVersion
  

  let resolver = getOrCreateResolver(event.params.node, event.address)

  let resolverVersionId = createResolverVersionID(resolver.id, event.params.newVersion)
  let resolverVersion = ResolverVersion.load(resolverVersionId)
  if (resolverVersion == null) {
    resolverEvent.isNewVersion = true
    resolverVersion = new ResolverVersion(resolverVersionId)
    resolverVersion.resolver = resolver.id
    resolverVersion.version = event.params.newVersion
    resolverVersion.save()
  } else {
    resolverEvent.isNewVersion = false
  }
  resolverEvent.save()
  
  resolver.version = event.params.newVersion
  resolver.addr = resolverVersion.addr
  resolver.texts = resolverVersion.texts
  resolver.coinTypes = resolverVersion.coinTypes
  resolver.save()
}

function makeVersionIdFromResolverId(resolverId: string): string {
  let resolver = Resolver.load(resolverId)!
  return createResolverVersionID(resolver.id, resolver.version)
}

function loadResolverVersionFromResolver(resolver: Resolver): ResolverVersion {
  return ResolverVersion.load(createResolverVersionID(resolver.id, resolver.version))!
}

function getOrCreateResolver(node: Bytes, address: Address): Resolver {
  let id = createResolverID(node, address)
  let resolver = Resolver.load(id)
  if(resolver === null) {
    resolver = new Resolver(id)
    resolver.domain = node.toHexString()
    resolver.address = address
    resolver.version = BigInt.fromI32(0)
    let resolverVersionId = createResolverVersionID(id, resolver.version)
    let resolverVersion = new ResolverVersion(resolverVersionId)
    resolverVersion.resolver = id
    resolverVersion.version = resolver.version
    resolverVersion.save()
  }
  return resolver as Resolver
}

function createEventID(event: ethereum.Event): string {
  return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

function createResolverID(node: Bytes, resolver: Address): string {
  return resolver.toHexString().concat('-').concat(node.toHexString())
}

function createResolverVersionID(resolverId: string, version: BigInt): string {
  return resolverId.concat('-').concat(version.toString())
}