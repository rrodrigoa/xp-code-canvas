import ELK from 'elkjs/lib/elk-api.js';
import ElkWorker from '../elk.worker?worker&inline';
export function createBrowserElk(){
  return new ELK({workerFactory:()=>new ElkWorker()});
}
