import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const LoginSuccess = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`http://localhost:3000/users/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const userData = await response.json();
        console.log("User fetched:", userData);

        if (!userData.role) {
          navigate('/select-role', { state: { userId: id } });
        } else {
          navigate('/dashboard'); 
        }

      } catch (error) {
        console.error("Login Error:", error);
        navigate('/?error=login_failed');
      }
    };

    if (id) {
      fetchUser();
    }
  }, [id, navigate]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Logging you in...</h2>
      <p>Please wait while we verify your account.</p>
    </div>
  );
};

export default LoginSuccess;