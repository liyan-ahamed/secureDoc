import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import foldersRouter from './folders';
import filesRouter from './files';
import sharesRouter from './shares';
import auditRouter from './audit';
import orgsRouter from './orgs';
import searchRouter from './search';
import trashRouter from './trash';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/folders', foldersRouter);
router.use('/files', filesRouter);
router.use('/shares', sharesRouter);
router.use('/audit', auditRouter);
router.use('/orgs', orgsRouter);
router.use('/search', searchRouter);
router.use('/trash', trashRouter);

export default router;
