import { FileMenu } from './FileMenu';
import { EditMenu } from './EditMenu';
import { ViewMenu } from './ViewMenu';
import { CanvasMenu } from './CanvasMenu';
import { ProjectStatusBar } from './ProjectStatusBar';
import styles from './MenuBar.module.css';

export function MenuBar() {
  return (
    <div className={styles.bar}>
      <FileMenu />
      <EditMenu />
      <ViewMenu />
      <CanvasMenu />
      <ProjectStatusBar />
    </div>
  );
}
