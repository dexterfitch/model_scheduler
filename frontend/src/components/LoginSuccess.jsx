import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const LoginSuccess = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Fetch the user's details from the backend
    const fetchUser = async () => {
      try {
        const response = await fetch(`http://localhost:3000/users/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const userData = await response.json();
        console.log("User fetched:", userData);

        // 2. Decide where to go
        if (!userData.role) {
          // If no role, force them to the selection page
          // We pass the ID in the state so the next page knows who to update
          navigate('/select-role', { state: { userId: id } });
        } else {
          // If role exists, go to dashboard
          // (You might want to save userData to a global Context here later)
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