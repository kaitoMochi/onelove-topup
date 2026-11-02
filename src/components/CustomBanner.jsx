import React from 'react';

export default function CustomBanner() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 my-3">
      <div className="custom-banner">
        <div className="custom-banner-left" aria-hidden="true"></div>
        <div className="custom-banner-center">
          <span className="custom-banner-title">ហ្គេមពេញនិយម</span>
          <span className="custom-banner-des">ហ្គេម សំរាប់បញ្ចូលទឹកប្រាក់</span>
        </div>
        <div className="custom-banner-right" aria-hidden="true"></div>
      </div>
    </div>
  );
}

