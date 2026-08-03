import { runSearchTestSuite } from './SearchTestSuite';
import { globalSearchEngine } from '../GlobalSearchEngine';

globalSearchEngine.debugMode = true;

runSearchTestSuite().then(res => console.log(res));
