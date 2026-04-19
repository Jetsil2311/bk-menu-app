import { useRegisterContext } from '../context/RegisterContext';

export const useRegister = () => {
  const { isRegisterOpen, openRegister, closeRegister } = useRegisterContext();
  return { isRegisterOpen, openRegister, closeRegister };
};
