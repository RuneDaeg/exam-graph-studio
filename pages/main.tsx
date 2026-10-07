import {createRoot} from 'react-dom/client';
import Studio from '../app/studio';
import 'katex/dist/katex.min.css';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<Studio/>);
