import runServer from './src/entry-server';
import { YelkenHandlerPage } from './types/interfaces/yelken-handler-page';
import { YelkenPluginInit } from './types/interfaces/yelken-plugin-init';

export const init: typeof YelkenPluginInit = {
  register(info) {
    console.log(`Initializing frontend plugin on host version ${info.version} and env ${info.environment}`);

    return {
      name: 'frontend',
      events: ['yelken:handler/page']
    };
  }
}

export const page: typeof YelkenHandlerPage = {
  load(request) {
    return runServer({ request });
  }
}
