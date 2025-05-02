import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import StudentScreen from './screens/StudentScreen';
import TeacherScreen from './screens/TeacherScreen';
import AdminScreen from './screens/AdminScreen';
import IntroScreen from './screens/IntroScreen';
import StudentSignupScreen from './screens/StudentSignupScreen';
import TeacherSignupScreen from './screens/TeacherSignupScreen';

// Import the login screens directly with full path
import StudentLoginScreen from './screens/StudentLoginScreen';
import TeacherLoginScreen from './screens/TeacherLoginScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';      


export type RootStackParamList = {
  Intro: undefined;
  RoleSelection: undefined;
  StudentLogin: undefined;
  TeacherLogin: undefined;
  AdminLogin:undefined;
  Student: undefined;
  Teacher: undefined;
  Admin: undefined;
  StudentSignup: undefined;
  TeacherSignup: undefined; 
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Intro">
        <Stack.Screen name="Intro" component={IntroScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="StudentLogin" component={StudentLoginScreen} />
        <Stack.Screen name="TeacherLogin" component={TeacherLoginScreen} />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="StudentSignup" component={StudentSignupScreen} />
        <Stack.Screen name="TeacherSignup" component={TeacherSignupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}