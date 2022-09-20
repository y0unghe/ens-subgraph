// Import types and APIs from graph-ts
import {
  BigInt,
  ByteArray,
  ethereum,
  Bytes,
  Address,
} from '@graphprotocol/graph-ts'
import { Resolver, ResolverVersions } from './types/schema'

export function createEventID(event:  ethereum.Event): string {
  return event.block.number.toString().concat('-').concat(event.logIndex.toString())
}

export const ROOT_NODE = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'

// Helper for concatenating two byte arrays
export function concat(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length)
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i]
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j]
  }
  // return out as ByteArray
  return changetype<ByteArray>(out)
}

export function byteArrayFromHex(s: string): ByteArray {
  if(s.length % 2 !== 0) {
    throw new TypeError("Hex string must have an even number of characters")
  }
  let out = new Uint8Array(s.length / 2)
  for(var i = 0; i < s.length; i += 2) {
    out[i / 2] = parseInt(s.substring(i, i + 2), 16) as u32
  }
  return changetype<ByteArray>(out)
}

export function uint256ToByteArray(i: BigInt): ByteArray {
  let hex = i.toHex().slice(2).padStart(64, '0')
  return byteArrayFromHex(hex)
}

export function createResolverVersionsID(node: Bytes, resolver: Address): string {
  return resolver.toHexString().concat('-').concat(node.toHexString())
}

export function createResolverID(node: Bytes, resolver: Address, version: BigInt): string {
  return createResolverVersionsID(node, resolver).concat('-').concat(version.toString())
}

export function getOrCreateResolver(node: Bytes, address: Address, _version: BigInt | null = null): Resolver {
  let resolverVersionsId = createResolverVersionsID(node, address)
  let resolverVersions = ResolverVersions.load(resolverVersionsId)
  let version = BigInt.fromI32(0)
  if (_version) {
    version = _version as BigInt
  }
  if (resolverVersions == null) {
    resolverVersions = new ResolverVersions(resolverVersionsId)
    resolverVersions.currentVersion = version
    resolverVersions.save()
  } else if (version > resolverVersions.currentVersion) {
    resolverVersions.currentVersion = version
    resolverVersions.save()
  }
  let id = createResolverID(node, address, resolverVersions.currentVersion)
  let resolver = Resolver.load(id)
  if(resolver == null) {
    resolver = new Resolver(id)
    resolver.domain = node.toHexString()
    resolver.address = address
    resolver.version = resolverVersions.currentVersion
    resolver.versions = resolverVersionsId
  }
  return resolver as Resolver
}

export function getResolverID(node: Bytes, resolverAddress: Address): string {
  let resolver = getOrCreateResolver(node, resolverAddress)
  return resolver.id
}