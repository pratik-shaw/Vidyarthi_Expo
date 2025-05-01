import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TeacherScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome, Teacher!</Text>
    </View>
  );
};

export default TeacherScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f8e9',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
  },
});
