import { ModuleRef } from '@nestjs/core';
import { Logger } from '@nestjs/common';
let globalModuleRef: ModuleRef;

export function setGlobalModuleRef(ref: ModuleRef) {
  globalModuleRef = ref;
}

export function getGlobalModuleRef(): ModuleRef {
  if (!globalModuleRef) {
    Logger.error('Global ModuleRef not set. Call setGlobalModuleRef in your app initialization.');
  }
  return globalModuleRef;
}
