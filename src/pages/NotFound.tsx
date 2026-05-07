import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            404
          </h1>
          <h2 className="text-3xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Pagina niet gevonden
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto">
            Sorry, de pagina die je zoekt bestaat niet of is verplaatst.
          </p>
        </div>
        
        <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <Link to="/">
            <Button>
              <Home className="h-5 w-5 mr-2" />
              Naar Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Ga Terug
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;