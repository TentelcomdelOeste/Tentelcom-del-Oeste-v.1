sed -i "4a import { ProjectFormModal } from './components/ProjectFormModal';\nimport { FiPlus } from 'react-icons/fi';" modules/project_management/ProjectManagementModule.tsx
sed -i "15a \ \ const [showModal, setShowModal] = useState(false);" modules/project_management/ProjectManagementModule.tsx
