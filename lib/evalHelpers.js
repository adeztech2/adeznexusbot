import { metadataCache } from './connection/metadataCache.js';
import { createRequire } from 'module';

const requireC = createRequire(import.meta.url);

export async function createEvalContext(sock, m) {
  const context = {};

  context.sock = sock;
  context.m = m;

  
  context.getMetadata = async () => {
    if (!m.isGroup) return null;
    return await metadataCache.get(sock, m.from);
  };

  context.refreshMetadata = async () => {
    if (!m.isGroup) return null;
    return await metadataCache.refresh(sock, m.from);
  };

  
  context.participants = async () => {
    const metadata = await context.getMetadata();
    return metadata?.participants || [];
  };

  context.admins = async () => {
    const metadata = await context.getMetadata();
    return metadata?.participants?.filter(p => p.admin === 'admin' || p.admin === 'superadmin') || [];
  };

  context.members = async () => {
    const metadata = await context.getMetadata();
    return metadata?.participants?.filter(p => !p.admin) || [];
  };

  context.isAdmin = async (phoneNumber) => {
    const metadata = await context.getMetadata();
    if (!metadata) return false;

    const participant = metadata.participants.find(p => p.phoneNumber === phoneNumber);
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
  };

  context.isBotAdmin = async () => {
    const botPhoneNumber = sock.user.id.replace(/:\d+/, '') + '@s.whatsapp.net';
    return await context.isAdmin(botPhoneNumber);
  };

  context.count = async () => {
    const metadata = await context.getMetadata();
    return {
      total: metadata?.size || 0,
      admins: metadata?.participants?.filter(p => p.admin)?.length || 0,
      members: metadata?.participants?.filter(p => !p.admin)?.length || 0
    };
  };

  context.subject = async () => {
    const metadata = await context.getMetadata();
    return metadata?.subject || null;
  };

  context.desc = async () => {
    const metadata = await context.getMetadata();
    return metadata?.desc || 'No description';
  };

  context.groupInfo = async () => {
    const metadata = await context.getMetadata();
    if (!metadata) return null;

    return {
      name: metadata.subject,
      description: metadata.desc,
      ownerPn: metadata.ownerPn,
      subjectOwnerPn: metadata.subjectOwnerPn,
      size: metadata.size,
      creation: new Date(metadata.creation * 1000).toLocaleString(),
      restrict: metadata.restrict,
      announce: metadata.announce,
      isCommunity: metadata.isCommunity
    };
  };

 
  context.cache = {
    stats: () => metadataCache.stats(),
    clear: () => metadataCache.clear(),
    invalidate: (jid) => metadataCache.invalidate(jid || m.from)
  };

  
  context.require = requireC;
  context.util = await import('util').then(m => m.default);
  context.console = console;
  context.JSON = JSON;
  context.Array = Array;
  context.Object = Object;
  context.String = String;
  context.Number = Number;
  context.Boolean = Boolean;
  context.Date = Date;
  context.Math = Math;
  context.Promise = Promise;

  return context;
}